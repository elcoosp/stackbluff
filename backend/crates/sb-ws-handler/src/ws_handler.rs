use axum::body::Bytes;
use axum::http::StatusCode;
use axum::{
    Router,
    extract::{Query, State, WebSocketUpgrade},
    response::{IntoResponse, Response},
    routing::get,
};
use axum_extra::extract::CookieJar;
use futures::{SinkExt, StreamExt};
use sb_auth::Authenticator;
use sb_contracts::repo_api::UserRepo;
use sb_shared_types::{ChipAmount, RequestContext, TableId, UserId};
use sb_table_registry::game_room::RoomMessage;
use sb_table_registry::registry::Registry;
use serde::Deserialize;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

#[derive(Deserialize)]
struct WsQuery {
    token: Option<String>,
}

struct AppState {
    auth: Arc<dyn Authenticator + Send + Sync>,
    registry: Arc<Registry>,
    user_repo: Arc<dyn UserRepo>,
}

pub fn ws_route(
    auth: Arc<dyn Authenticator + Send + Sync>,
    registry: Arc<Registry>,
    user_repo: Arc<dyn UserRepo>,
) -> Router {
    let state = Arc::new(AppState {
        auth,
        registry,
        user_repo,
    });
    Router::new()
        .route("/ws/game", get(ws_handler))
        .with_state(state)
}

async fn ws_handler(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> Response {
    let token = jar
        .get("token")
        .map(|c| c.value().to_string())
        .or(query.token);
    let token = match token {
        Some(t) => t,
        None => {
            warn!("WebSocket missing token");
            return (StatusCode::UNAUTHORIZED, "Missing token").into_response();
        }
    };

    let user_id = match state.auth.validate_token(&token).await {
        Ok(uid) => uid,
        Err(e) => {
            warn!(error = %e, "JWT validation failed");
            return (StatusCode::UNAUTHORIZED, "Invalid token").into_response();
        }
    };

    info!(%user_id, "WebSocket upgrade authenticated");
    ws.on_upgrade(move |socket| handle_websocket(socket, state, user_id))
}

fn send_error(
    client_tx: &tokio::sync::mpsc::UnboundedSender<axum::extract::ws::Message>,
    room_id: Option<TableId>,
    target_user_id: Option<UserId>,
    message: &str,
) -> bool {
    let err_msg = RoomMessage::Error {
        room_id,
        target_user_id,
        message: message.to_string(),
    };
    serde_json::to_string(&err_msg)
        .map(|json| client_tx.send(axum::extract::ws::Message::Text(json.into())).is_ok())
        .unwrap_or(false)
}

async fn handle_websocket(
    socket: axum::extract::ws::WebSocket,
    state: Arc<AppState>,
    user_id: UserId,
) {
    info!(%user_id, "WebSocket handler started");
    let (mut ws_sender, mut ws_receiver) = socket.split();

    let (client_tx, mut client_rx) =
        tokio::sync::mpsc::unbounded_channel::<axum::extract::ws::Message>();

    let send_task = tokio::spawn(async move {
        while let Some(msg) = client_rx.recv().await {
            if let Err(e) = ws_sender.send(msg).await {
                warn!("WebSocket send failed: {}", e);
                break;
            }
        }
        info!("WebSocket send task finished");
    });

    let (actor_msg_tx, mut actor_msg_rx) = mpsc::unbounded_channel::<RoomMessage>();
    let mut active_rooms: HashSet<TableId> = HashSet::new();
    const MAX_TABLES: usize = 4;

    let mut ping_interval = tokio::time::interval(std::time::Duration::from_secs(30));

    loop {
        tokio::select! {
            Some(room_msg) = actor_msg_rx.recv() => {
                match serde_json::to_string(&room_msg) {
                    Ok(json) => {
                        if client_tx.send(axum::extract::ws::Message::Text(json.into())).is_err() {
                            warn!("Failed to send broadcast to client_tx (send task dead)");
                            break;
                        }
                    }
                    Err(e) => {
                        error!(%user_id, error = %e, "Failed to serialize RoomMessage");
                    }
                }
            }

            msg = ws_receiver.next() => {
                match msg {
                    Some(Ok(axum::extract::ws::Message::Text(text))) => {
                        debug!(%user_id, text = %text, "Received client message");
                        if !handle_client_message(
                            &state,
                            &user_id,
                            &text,
                            &client_tx,
                            &actor_msg_tx,
                            &mut active_rooms,
                            MAX_TABLES,
                        )
                        .await
                        {
                            warn!(%user_id, "Terminating WebSocket — send task is dead");
                            break;
                        }
                    }
                    Some(Ok(axum::extract::ws::Message::Pong(_))) => {
                        debug!(%user_id, "Received pong");
                    }
                    Some(Ok(axum::extract::ws::Message::Close(frame))) => {
                        info!(%user_id, "Received close frame from client");
                        let _ = client_tx.send(axum::extract::ws::Message::Close(frame));
                        break;
                    }
                    Some(Ok(axum::extract::ws::Message::Ping(data))) => {
                        debug!(%user_id, "Received ping, sending pong");
                        let _ = client_tx.send(axum::extract::ws::Message::Pong(data));
                    }
                    Some(Ok(axum::extract::ws::Message::Binary(_))) => {
                        debug!(%user_id, "Received binary message (ignored)");
                    }
                    Some(Err(e)) => {
                        error!(%user_id, error = %e, "WebSocket receive error");
                        break;
                    }
                    None => {
                        info!(%user_id, "WebSocket receive stream ended (connection closed)");
                        break;
                    }
                }
            }

            _ = ping_interval.tick() => {
                debug!(%user_id, "Sending ping");
                if client_tx
                    .send(axum::extract::ws::Message::Ping(Bytes::new()))
                    .is_err()
                {
                    warn!("Failed to send ping (send task dead)");
                    break;
                }
            }
        }
    }

    info!(%user_id, "WebSocket handler loop exited");

    for room_id in active_rooms {
        let registry = state.registry.clone();
        let user_repo = state.user_repo.clone();
        tokio::spawn(async move {
            info!(%user_id, %room_id, "Disconnect cleanup: sending leave");
            match registry.send_leave(room_id, user_id, true).await {
                Ok(remaining_stack) => {
                    if remaining_stack > ChipAmount::new(0).unwrap() {
                        let ctx = RequestContext::new(Uuid::new_v4(), Some(user_id));
                        if let Err(e) = user_repo
                            .update_chip_balance(ctx, user_id, remaining_stack.as_i64())
                            .await
                        {
                            error!(%user_id, error = ?e, "Failed to credit remaining stack on disconnect");
                        }
                    }
                    info!(%user_id, %room_id, "Disconnect cleanup: leave successful");
                }
                Err(e) => {
                    error!(%user_id, %room_id, error = ?e, "Failed to leave room on disconnect");
                }
            }
        });
    }

    send_task.abort();
    info!(%user_id, "WebSocket handler finished");
}

async fn handle_client_message(
    state: &Arc<AppState>,
    user_id: &UserId,
    text: &str,
    client_tx: &tokio::sync::mpsc::UnboundedSender<axum::extract::ws::Message>,
    actor_msg_tx: &tokio::sync::mpsc::UnboundedSender<RoomMessage>,
    active_rooms: &mut HashSet<TableId>,
    max_tables: usize,
) -> bool {
    let parsed: serde_json::Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(e) => {
            warn!(%user_id, error = %e, "Invalid JSON from client");
            return true;
        }
    };

    let msg_type = parsed.get("type").and_then(|t| t.as_str()).unwrap_or("");

    match msg_type {
        "reconnect" => {
            debug!(%user_id, "Processing reconnect");
            let user_rooms = state.registry.find_all_user_rooms(*user_id).await;
            if user_rooms.is_empty() {
                debug!(%user_id, "Reconnect failed: no active rooms found");
                let err = RoomMessage::Error {
                    room_id: None,
                    target_user_id: None,
                    message: "Not seated at table. Please buy in.".into(),
                };
                if let Ok(json) = serde_json::to_string(&err) {
                    if !client_tx.send(axum::extract::ws::Message::Text(json.into())).is_ok() {
                        return false;
                    }
                }
                return true;
            }
            for room_id in user_rooms {
                debug!(%user_id, %room_id, "Attempting to reconnect to room");
                match state
                    .registry
                    .send_reconnect(room_id, *user_id, actor_msg_tx.clone())
                    .await
                {
                    Ok(true) => {
                        active_rooms.insert(room_id);
                    }
                    Ok(false) => {
                        let err = RoomMessage::Error {
                            room_id: Some(room_id),
                            target_user_id: Some(*user_id),
                            message: "Not seated at table. Please buy in.".into(),
                        };
                        if let Ok(json) = serde_json::to_string(&err) {
                            if !client_tx.send(axum::extract::ws::Message::Text(json.into())).is_ok() {
                                return false;
                            }
                        }
                    }
                    Err(e) => {
                        error!(%user_id, %room_id, error = ?e, "Reconnect failed, treating as not seated");
                        let err = RoomMessage::Error {
                            room_id: Some(room_id),
                            target_user_id: Some(*user_id),
                            message: "Not seated at table. Please buy in.".into(),
                        };
                        if let Ok(json) = serde_json::to_string(&err) {
                            if !client_tx.send(axum::extract::ws::Message::Text(json.into())).is_ok() {
                                return false;
                            }
                        }
                    }
                }
            }
        }

        "join_table" => {
            debug!(%user_id, "Processing join_table");
            if active_rooms.len() >= max_tables {
                if !send_error(client_tx, None, None, "Maximum table limit reached.") {
                    return false;
                }
                return true;
            }

            let table_id_str = parsed
                .get("table_id")
                .and_then(|t| t.as_str())
                .unwrap_or("");
            let table_id = match table_id_str.parse::<TableId>() {
                Ok(id) => id,
                Err(e) => {
                    return send_error(client_tx, None, None, &format!("Invalid table_id: {}", e));
                }
            };

            let user_rooms = state.registry.find_all_user_rooms(*user_id).await;

            let room_id = match state.registry.assign_room(table_id, user_rooms).await {
                Ok(id) => id,
                Err(e) => {
                    return send_error(client_tx, None, None, &format!("Failed to assign room: {:?}", e));
                }
            };

            let seat_opt = parsed.get("seat").and_then(|s| s.as_u64()).map(|s| s as u8);
            let buy_in: i64 = parsed
                .get("buy_in")
                .and_then(|b| b.as_i64())
                .unwrap_or(1000);

            let stack = match ChipAmount::new(buy_in) {
                Some(s) => s,
                None => {
                    return send_error(client_tx, None, None, &format!("Invalid buy_in amount: {}. Must be a non-negative integer.", buy_in));
                }
            };

            if let Some(cfg) = state.registry.get_table_config(table_id).await {
                if stack < cfg.min_buy_in || stack > cfg.max_buy_in {
                    return send_error(client_tx, None, None, &format!(
                        "Buy-in of {} is outside the allowed range ({}–{}).",
                        stack.as_i64(),
                        cfg.min_buy_in.as_i64(),
                        cfg.max_buy_in.as_i64()
                    ));
                }
            }

            let ctx = RequestContext::new(Uuid::new_v4(), Some(*user_id));
            let display_name = match state
                .user_repo
                .get_user_profile(ctx.clone(), *user_id)
                .await
            {
                Ok(profile) => profile.display_name,
                Err(_) => "Player".to_string(),
            };

            active_rooms.insert(room_id);
            let assigned_msg = RoomMessage::RoomAssigned {
                table_id,
                room_id,
            };
            if let Ok(json) = serde_json::to_string(&assigned_msg) {
                if !client_tx.send(axum::extract::ws::Message::Text(json.into())).is_ok() {
                    return false;
                }
            }

            info!(%user_id, %table_id, %room_id, buy_in = buy_in, "Attempting to join table");
            match state
                .registry
                .join_room_full(
                    room_id,
                    *user_id,
                    display_name,
                    seat_opt,
                    stack,
                    actor_msg_tx.clone(),
                )
                .await
            {
                Ok(is_new_join) => {
                    info!(%user_id, %table_id, %room_id, is_new_join, "Successfully joined table");

                    if is_new_join {
                        match state
                            .user_repo
                            .update_chip_balance(ctx.clone(), *user_id, -buy_in)
                            .await
                        {
                            Ok(new_balance) => {
                                let balance_msg = serde_json::to_string(&serde_json::json!({
                                    "type": "BalanceUpdated",
                                    "balance": new_balance
                                }))
                                .unwrap();
                                let _ = client_tx.send(axum::extract::ws::Message::Text(balance_msg.into()));
                            }
                            Err(e) => {
                                error!(%user_id, error = ?e, "Insufficient balance for buy-in");
                                if !send_error(client_tx, None, None, "Insufficient balance for buy-in") {
                                    return false;
                                }
                                let _ = state.registry.send_leave(room_id, *user_id, true).await;
                            }
                        }
                    }
                }
                Err(e) => {
                    error!(%user_id, %table_id, %room_id, error = ?e, "Failed to join table");
                    return send_error(client_tx, None, None, &format!("Failed to join: {:?}", e));
                }
            }
        }

        "rebuy" => {
            let room_id_str = parsed.get("room_id").and_then(|t| t.as_str()).unwrap_or("");
            let room_id = match room_id_str.parse::<TableId>() {
                Ok(id) => id,
                Err(e) => {
                    return send_error(client_tx, None, None, &format!("Invalid room_id: {}", e));
                }
            };

            let amount = parsed
                .get("amount")
                .and_then(|a| a.as_i64())
                .unwrap_or(1000);
            let stack = match ChipAmount::new(amount) {
                Some(s) => s,
                None => {
                    return send_error(client_tx, Some(room_id), None, "Invalid rebuy amount");
                }
            };

            let ctx = RequestContext::new(Uuid::new_v4(), Some(*user_id));
            match state
                .user_repo
                .update_chip_balance(ctx.clone(), *user_id, -amount)
                .await
            {
                Ok(new_balance) => {
                    let balance_msg = serde_json::to_string(&serde_json::json!({
                        "type": "BalanceUpdated",
                        "balance": new_balance
                    }))
                    .unwrap();
                    let _ = client_tx.send(axum::extract::ws::Message::Text(balance_msg.into()));
                }
                Err(e) => {
                    error!(%user_id, error = ?e, "Insufficient balance for rebuy");
                    if !send_error(client_tx, Some(room_id), None, "Insufficient balance for rebuy") {
                        return false;
                    }
                    return true;
                }
            }

            if let Err(e) = state.registry.send_rebuy(room_id, *user_id, stack).await {
                error!(%user_id, %room_id, error = ?e, "Rebuy failed");
                if !send_error(client_tx, Some(room_id), None, &format!("Rebuy failed: {:?}", e)) {
                    return false;
                }
                let _ = state
                    .user_repo
                    .update_chip_balance(ctx, *user_id, amount)
                    .await;
            }
        }

        "leave_table" => {
            let room_id_str = parsed.get("room_id").and_then(|t| t.as_str()).unwrap_or("");
            let room_id = match room_id_str.parse::<TableId>() {
                Ok(id) => id,
                Err(e) => {
                    return send_error(client_tx, None, None, &format!("Invalid room_id: {}", e));
                }
            };

            if !active_rooms.remove(&room_id) {
                if !send_error(client_tx, Some(room_id), None, "Not at this table") {
                    return false;
                }
                return true;
            }

            let registry = state.registry.clone();
            let user_repo = state.user_repo.clone();
            let user_id = *user_id;
            let client_tx = client_tx.clone();

            tokio::spawn(async move {
                match registry.send_leave(room_id, user_id, true).await {
                    Ok(remaining_stack) => {
                        if remaining_stack > ChipAmount::new(0).unwrap() {
                            let ctx = RequestContext::new(Uuid::new_v4(), Some(user_id));
                            match user_repo
                                .update_chip_balance(ctx, user_id, remaining_stack.as_i64())
                                .await
                            {
                                Ok(new_balance) => {
                                    let balance_msg = serde_json::to_string(&serde_json::json!({
                                        "type": "BalanceUpdated",
                                        "balance": new_balance
                                    }))
                                    .unwrap();
                                    let _ = client_tx.send(axum::extract::ws::Message::Text(balance_msg.into()));
                                }
                                Err(e) => {
                                    error!(%user_id, error = ?e, "Failed to credit remaining stack on leave");
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error!(%user_id, %room_id, error = ?e, "Leave failed");
                        let err = RoomMessage::Error {
                            room_id: Some(room_id),
                            target_user_id: Some(user_id),
                            message: format!("Failed to leave: {:?}", e),
                        };
                        if let Ok(json) = serde_json::to_string(&err) {
                            let _ = client_tx.send(axum::extract::ws::Message::Text(json.into()));
                        }
                    }
                }
            });
        }

        "player_action" => {
            let room_id_str = parsed.get("room_id").and_then(|t| t.as_str()).unwrap_or("");
            let room_id = match room_id_str.parse::<TableId>() {
                Ok(id) => id,
                Err(e) => {
                    return send_error(client_tx, None, None, &format!("Invalid room_id: {}", e));
                }
            };

            let action_str = parsed
                .get("action")
                .and_then(|a| a.as_str())
                .unwrap_or("fold");
            let action_type = match action_str {
                "fold" => sb_shared_types::ActionType::Fold,
                "check" => sb_shared_types::ActionType::Check,
                "call" => sb_shared_types::ActionType::Call,
                "raise" => sb_shared_types::ActionType::Raise,
                "allin" => sb_shared_types::ActionType::AllIn,
                "bet" => sb_shared_types::ActionType::Bet,
                _ => {
                    return send_error(client_tx, Some(room_id), None, &format!("Unknown action: {}", action_str));
                }
            };

            let amount = parsed
                .get("amount")
                .and_then(|a| a.as_i64())
                .and_then(ChipAmount::new);

            if let Err(e) = state
                .registry
                .send_player_action(room_id, *user_id, action_type, amount)
                .await
            {
                error!(%user_id, %room_id, error = ?e, "Player action failed");
                if !send_error(client_tx, Some(room_id), None, &format!("Action failed: {:?}", e)) {
                    return false;
                }
            }
        }

        "start_hand" => {
            let room_id_str = parsed.get("room_id").and_then(|t| t.as_str()).unwrap_or("");
            let room_id = match room_id_str.parse::<TableId>() {
                Ok(id) => id,
                Err(e) => {
                    return send_error(client_tx, None, None, &format!("Invalid room_id: {}", e));
                }
            };
            if let Err(e) = state.registry.start_hand(room_id).await {
                error!(%user_id, %room_id, error = ?e, "Start hand failed");
                if !send_error(client_tx, Some(room_id), None, &format!("Start hand failed: {:?}", e)) {
                    return false;
                }
            }
        }

        "kick_vote_start" => {
            let room_id_str = parsed.get("room_id").and_then(|t| t.as_str()).unwrap_or("");
            let room_id = match room_id_str.parse::<TableId>() {
                Ok(id) => id,
                Err(e) => {
                    return send_error(client_tx, None, None, &format!("Invalid room_id: {}", e));
                }
            };
            let target_id_str = parsed.get("target_player_id").and_then(|t| t.as_str()).unwrap_or("");
            let target_id = match target_id_str.parse::<UserId>() {
                Ok(id) => id,
                Err(_) => {
                    return send_error(client_tx, Some(room_id), None, "Invalid target_player_id");
                }
            };
            let (refund_tx, mut refund_rx) = tokio::sync::oneshot::channel::<ChipAmount>();
            match state.registry.start_kick_vote(room_id, *user_id, target_id, Some(refund_tx)).await {
                Ok(()) => {
                    tokio::spawn(async move {
                        if let Ok(refund) = refund_rx.await {
                            let ctx = RequestContext::new(Uuid::new_v4(), Some(*user_id));
                            if let Ok(new_balance) = state.user_repo.update_chip_balance(ctx, *user_id, refund.as_i64()).await {
                                let balance_msg = serde_json::to_string(&serde_json::json!({
                                    "type": "BalanceUpdated",
                                    "balance": new_balance
                                })).unwrap();
                                let _ = client_tx.send(axum::extract::ws::Message::Text(balance_msg.into()));
                            }
                        }
                    });
                }
                Err(e) => {
                    if !send_error(client_tx, Some(room_id), None, &format!("Kick vote failed: {:?}", e)) {
                        return false;
                    }
                }
            }
        }

        "kick_vote_yes" => {
            let room_id_str = parsed.get("room_id").and_then(|t| t.as_str()).unwrap_or("");
            let room_id = match room_id_str.parse::<TableId>() {
                Ok(id) => id,
                Err(e) => {
                    return send_error(client_tx, None, None, &format!("Invalid room_id: {}", e));
                }
            };
            let kick_vote_id_str = parsed.get("kick_vote_id").and_then(|t| t.as_str()).unwrap_or("");
            let kick_vote_id = match Uuid::parse_str(kick_vote_id_str) {
                Ok(id) => id,
                Err(_) => {
                    return send_error(client_tx, Some(room_id), None, "Invalid kick_vote_id");
                }
            };
            if let Err(e) = state.registry.vote_kick_yes(room_id, *user_id, kick_vote_id).await {
                if !send_error(client_tx, Some(room_id), None, &format!("Vote failed: {:?}", e)) {
                    return false;
                }
            }
        }

        "ping" => {
            debug!(%user_id, "Received ping, sending pong");
            let pong = serde_json::to_string(&serde_json::json!({"type": "pong"})).unwrap();
            if !client_tx.send(axum::extract::ws::Message::Text(pong.into())).is_ok() {
                return false;
            }
        }

        _ => {
            warn!(%user_id, msg_type, "Unknown message type from client");
        }
    }

    true
}
