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
use sb_shared_types::{ChipAmount, TableId, UserId};
use sb_table_registry::game_room::RoomMessage;
use sb_table_registry::registry::Registry;
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

#[derive(Deserialize)]
struct WsQuery {
    token: Option<String>,
}

struct AppState {
    auth: Arc<dyn Authenticator + Send + Sync>,
    registry: Arc<Registry>,
}

pub fn ws_route(auth: Arc<dyn Authenticator + Send + Sync>, registry: Arc<Registry>) -> Router {
    let state = Arc::new(AppState { auth, registry });
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

async fn handle_websocket(
    socket: axum::extract::ws::WebSocket,
    state: Arc<AppState>,
    user_id: UserId,
) {
    info!(%user_id, "WebSocket handler started");
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Channel for sending messages from the broadcast loop to the WebSocket send task
    let (client_tx, mut client_rx) =
        tokio::sync::mpsc::unbounded_channel::<axum::extract::ws::Message>();

    // Spawn a task to actually send messages over the WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = client_rx.recv().await {
            if let Err(e) = ws_sender.send(msg).await {
                warn!("WebSocket send failed: {}", e);
                break;
            }
        }
        info!("WebSocket send task finished");
    });

    let mut broadcast_rx: Option<broadcast::Receiver<RoomMessage>> = None;
    let mut current_table_id: Option<TableId> = None;

    let mut ping_interval = tokio::time::interval(std::time::Duration::from_secs(30));

    // Main loop: handle broadcasts, incoming messages, and pings
    loop {
        tokio::select! {
            // Broadcast reception
            msg = async {
                if let Some(rx) = broadcast_rx.as_mut() {
                    rx.recv().await
                } else {
                    // If not joined, wait forever (we don't want to spin)
                    std::future::pending().await
                }
            } => {
                match msg {
                    Ok(room_msg) => {
                        // Skip messages not intended for this user
                        let skip = match &room_msg {
                            RoomMessage::Error { target_user_id, .. } => {
                                if let Some(target) = target_user_id {
                                    *target != user_id
                                } else {
                                    false
                                }
                            }
                            RoomMessage::PrivateMessage { target_user_id, .. } => {
                                *target_user_id != user_id
                            }
                            _ => false,
                        };
                        if skip {
                            debug!(%user_id, "Skipping message not for this user");
                            continue;
                        }
                        // Serialize and send
                        match serde_json::to_string(&room_msg) {
                            Ok(json) => {
                                let msg_type = match &room_msg {
                                    RoomMessage::TableState(_) => "TableState",
                                    RoomMessage::ActionRequired(_) => "ActionRequired",
                                    RoomMessage::ActionBroadcast(_) => "ActionBroadcast",
                                    RoomMessage::HandResult(_) => "HandResult",
                                    RoomMessage::ShowdownReveal(_) => "ShowdownReveal",
                                    RoomMessage::Error { .. } => "Error",
                                    RoomMessage::Connected { .. } => "Connected",
                                    RoomMessage::PrivateMessage { .. } => "PrivateMessage",
                                };
                                debug!(%user_id, msg_type, "Sending broadcast message");
                                if client_tx.send(axum::extract::ws::Message::Text(json.into())).is_err() {
                                    warn!("Failed to send broadcast to client_tx (send task dead)");
                                    break;
                                }
                            }
                            Err(e) => {
                                error!(%user_id, error = %e, "Failed to serialize RoomMessage");
                                // Continue to next message
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        warn!(%user_id, n, "Broadcast lagged, skipping messages");
                    }
                    Err(e) => {
                        warn!(%user_id, error = %e, "Broadcast receiver error, exiting loop");
                        break;
                    }
                }
            }

            // Incoming WebSocket messages
            msg = ws_receiver.next() => {
                match msg {
                    Some(Ok(axum::extract::ws::Message::Text(text))) => {
                        debug!(%user_id, text = %text, "Received client message");
                        handle_client_message(&state, &user_id, &text, &client_tx, &mut broadcast_rx, &mut current_table_id).await;
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

            // Periodic ping to keep connection alive
            _ = ping_interval.tick() => {
                debug!(%user_id, "Sending ping");
                if client_tx.send(axum::extract::ws::Message::Ping(Bytes::new())).is_err() {
                    warn!("Failed to send ping (send task dead)");
                    break;
                }
            }
        }
    }

    info!(%user_id, "WebSocket handler loop exited");

    // Leave table if joined
    if let Some(table_id) = current_table_id {
        info!(%user_id, %table_id, "Sending leave to table actor");
        if let Err(e) = state.registry.send_leave(table_id, user_id).await {
            warn!(%user_id, %table_id, error = %e, "Failed to send leave");
        }
    }

    // Abort the send task (it should already be finished, but just in case)
    send_task.abort();
    info!(%user_id, "WebSocket handler finished");
}

async fn handle_client_message(
    state: &Arc<AppState>,
    user_id: &UserId,
    text: &str,
    client_tx: &tokio::sync::mpsc::UnboundedSender<axum::extract::ws::Message>,
    broadcast_rx: &mut Option<broadcast::Receiver<RoomMessage>>,
    current_table_id: &mut Option<TableId>,
) {
    let parsed: serde_json::Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(e) => {
            warn!(%user_id, error = %e, "Invalid JSON from client");
            return;
        }
    };

    let msg_type = parsed.get("type").and_then(|t| t.as_str()).unwrap_or("");

    match msg_type {
        "join_table" => {
            let table_id_str = parsed
                .get("table_id")
                .and_then(|t| t.as_str())
                .unwrap_or("");
            let table_id = match table_id_str.parse::<TableId>() {
                Ok(id) => id,
                Err(e) => {
                    let err = serde_json::json!({"type": "Error", "message": format!("Invalid table_id: {}", e)});
                    let _ =
                        client_tx.send(axum::extract::ws::Message::Text(err.to_string().into()));
                    return;
                }
            };

            let seat_opt = parsed.get("seat").and_then(|s| s.as_u64()).map(|s| s as u8);

            // ── Parse and validate buy_in ──
            let buy_in: i64 = parsed
                .get("buy_in")
                .and_then(|b| b.as_i64())
                .unwrap_or(1000);

            let stack = match ChipAmount::new(buy_in) {
                Some(s) => s,
                None => {
                    let err = serde_json::json!({
                        "type": "Error",
                        "message": format!("Invalid buy_in amount: {}. Must be a non-negative integer.", buy_in)
                    });
                    let _ =
                        client_tx.send(axum::extract::ws::Message::Text(err.to_string().into()));
                    return;
                }
            };

            // ── Early validation against table limits BEFORE joining ──
            // This prevents sending a premature "Connected" message when the buy-in is rejected.
            match state.registry.get_table_config(table_id).await {
                Some(cfg) => {
                    if stack < cfg.min_buy_in || stack > cfg.max_buy_in {
                        let err = serde_json::json!({
                            "type": "Error",
                            "message": format!(
                                "Buy-in of {} is outside the allowed range ({}–{}).",
                                stack.as_i64(),
                                cfg.min_buy_in.as_i64(),
                                cfg.max_buy_in.as_i64()
                            )
                        });
                        let _ = client_tx
                            .send(axum::extract::ws::Message::Text(err.to_string().into()));
                        return;
                    }
                }
                None => {
                    // Table not found — let join_table_full handle the error
                }
            }

            info!(%user_id, %table_id, buy_in = buy_in, "Attempting to join table");
            match state
                .registry
                .join_table_full(table_id, *user_id, seat_opt, stack)
                .await
            {
                Ok(()) => {
                    info!(%user_id, %table_id, "Successfully joined table");
                    // Subscribe to broadcasts from this table
                    match state.registry.subscribe_to_table(table_id).await {
                        Some(bcast_tx) => {
                            *broadcast_rx = Some(bcast_tx.subscribe());
                            info!(%user_id, %table_id, "Subscribed to table broadcast");
                            // Send a Connected message to the client
                            let connected = RoomMessage::Connected {
                                user_id: *user_id,
                                seat_index: seat_opt.unwrap_or(0), // backend may override, but this is a placeholder
                            };
                            if let Ok(json) = serde_json::to_string(&connected) {
                                let _ =
                                    client_tx.send(axum::extract::ws::Message::Text(json.into()));
                            }
                        }
                        None => {
                            warn!(%user_id, %table_id, "Failed to subscribe to table broadcast (no broadcast sender)");
                            let err = serde_json::json!({"type": "Error", "message": "Table broadcast unavailable"});
                            let _ = client_tx
                                .send(axum::extract::ws::Message::Text(err.to_string().into()));
                            return;
                        }
                    }
                    *current_table_id = Some(table_id);
                }
                Err(e) => {
                    error!(%user_id, %table_id, error = ?e, "Failed to join table");
                    let err = serde_json::json!({"type": "Error", "message": format!("Failed to join: {:?}", e)});
                    let _ =
                        client_tx.send(axum::extract::ws::Message::Text(err.to_string().into()));
                }
            }
        }

        "rebuy" => {
            let table_id = match current_table_id {
                Some(id) => *id,
                None => {
                    let err = serde_json::json!({"type": "Error", "message": "Not at a table"});
                    let _ =
                        client_tx.send(axum::extract::ws::Message::Text(err.to_string().into()));
                    return;
                }
            };

            let amount = parsed
                .get("amount")
                .and_then(|a| a.as_i64())
                .unwrap_or(1000);
            let stack = match ChipAmount::new(amount) {
                Some(s) => s,
                None => {
                    let err =
                        serde_json::json!({"type": "Error", "message": "Invalid rebuy amount"});
                    let _ =
                        client_tx.send(axum::extract::ws::Message::Text(err.to_string().into()));
                    return;
                }
            };

            if let Err(e) = state.registry.send_rebuy(table_id, *user_id, stack).await {
                error!(%user_id, %table_id, error = ?e, "Rebuy failed");
                let err = serde_json::json!({"type": "Error", "message": format!("Rebuy failed: {:?}", e)});
                let _ = client_tx.send(axum::extract::ws::Message::Text(err.to_string().into()));
            }
        }

        "player_action" => {
            let table_id = match current_table_id {
                Some(id) => *id,
                None => {
                    let err = serde_json::json!({"type": "Error", "message": "Not at a table"});
                    let _ =
                        client_tx.send(axum::extract::ws::Message::Text(err.to_string().into()));
                    return;
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
                    let err = serde_json::json!({"type": "Error", "message": format!("Unknown action: {}", action_str)});
                    let _ =
                        client_tx.send(axum::extract::ws::Message::Text(err.to_string().into()));
                    return;
                }
            };

            let amount = parsed
                .get("amount")
                .and_then(|a| a.as_i64())
                .and_then(|v| ChipAmount::new(v));

            debug!(%user_id, %table_id, action = action_str, amount = ?amount, "Sending player action");
            if let Err(e) = state
                .registry
                .send_player_action(table_id, *user_id, action_type, amount)
                .await
            {
                error!(%user_id, %table_id, error = ?e, "Player action failed");
                let err = serde_json::json!({"type": "Error", "message": format!("Action failed: {:?}", e)});
                let _ = client_tx.send(axum::extract::ws::Message::Text(err.to_string().into()));
            }
        }

        "start_hand" => {
            let table_id = match current_table_id {
                Some(id) => *id,
                None => {
                    let err = serde_json::json!({"type": "Error", "message": "Not at a table"});
                    let _ =
                        client_tx.send(axum::extract::ws::Message::Text(err.to_string().into()));
                    return;
                }
            };
            debug!(%user_id, %table_id, "Client requested start_hand");
            if let Err(e) = state.registry.start_hand(table_id).await {
                error!(%user_id, %table_id, error = ?e, "Start hand failed");
                let err = serde_json::json!({"type": "Error", "message": format!("Start hand failed: {:?}", e)});
                let _ = client_tx.send(axum::extract::ws::Message::Text(err.to_string().into()));
            }
        }

        "ping" => {
            debug!(%user_id, "Received ping, sending pong");
            let pong = serde_json::json!({"type": "pong"});
            let _ = client_tx.send(axum::extract::ws::Message::Text(pong.to_string().into()));
        }

        _ => {
            warn!(%user_id, msg_type, "Unknown message type from client");
        }
    }
}
