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
struct WsQuery { token: Option<String> }

struct AppState {
    auth: Arc<dyn Authenticator + Send + Sync>,
    registry: Arc<Registry>,
    user_repo: Arc<dyn UserRepo>,
}

pub fn ws_route(auth: Arc<dyn Authenticator + Send + Sync>, registry: Arc<Registry>, user_repo: Arc<dyn UserRepo>) -> Router {
    let state = Arc::new(AppState { auth, registry, user_repo });
    Router::new().route("/ws/game", get(ws_handler)).with_state(state)
}

async fn ws_handler(State(state): State<Arc<AppState>>, jar: CookieJar, Query(query): Query<WsQuery>, ws: WebSocketUpgrade) -> Response {
    let token = jar.get("token").map(|c| c.value().to_string()).or(query.token);
    let token = match token { Some(t) => t, None => return (StatusCode::UNAUTHORIZED, "Missing token").into_response() };
    let user_id = match state.auth.validate_token(&token).await { Ok(uid) => uid, Err(e) => { warn!(error = %e); return (StatusCode::UNAUTHORIZED, "Invalid token").into_response(); } };
    info!(%user_id, "WebSocket upgrade authenticated");
    ws.on_upgrade(move |socket| handle_websocket(socket, state, user_id))
}

fn send_error(client_tx: &tokio::sync::mpsc::UnboundedSender<axum::extract::ws::Message>, room_id: Option<TableId>, target_user_id: Option<UserId>, message: &str) -> bool {
    let err_msg = RoomMessage::Error { room_id, target_user_id, message: message.to_string() };
    serde_json::to_string(&err_msg).map(|json| client_tx.send(axum::extract::ws::Message::Text(json.into())).is_ok()).unwrap_or(false)
}

async fn handle_websocket(socket: axum::extract::ws::WebSocket, state: Arc<AppState>, user_id: UserId) { /* … same as original, omitted for brevity … */ }

async fn handle_client_message(
    state: &Arc<AppState>, user_id: &UserId, text: &str,
    client_tx: &tokio::sync::mpsc::UnboundedSender<axum::extract::ws::Message>,
    actor_msg_tx: &tokio::sync::mpsc::UnboundedSender<RoomMessage>,
    active_rooms: &mut HashSet<TableId>, max_tables: usize,
) -> bool {
    let parsed: serde_json::Value = match serde_json::from_str(text) { Ok(v) => v, Err(_) => return true };
    let msg_type = parsed.get("type").and_then(|t| t.as_str()).unwrap_or("");

    match msg_type {
        // … other arms (reconnect, join_table, rebuy, leave_table, player_action, start_hand, ping) …
        "kick_vote_start" => {
            let room_id = parsed.get("room_id").and_then(|t| t.as_str()).and_then(|s| s.parse::<TableId>().ok());
            let target_id = parsed.get("target_player_id").and_then(|t| t.as_str()).and_then(|s| s.parse::<UserId>().ok());
            let (refund_tx, mut refund_rx) = tokio::sync::oneshot::channel::<ChipAmount>();
            match state.registry.start_kick_vote(room_id.unwrap(), *user_id, target_id.unwrap(), Some(refund_tx)).await {
                Ok(()) => {
                    tokio::spawn(async move {
                        if let Ok(refund) = refund_rx.await {
                            let ctx = RequestContext::new(Uuid::new_v4(), Some(*user_id));
                            if let Ok(new_balance) = state.user_repo.update_chip_balance(ctx, *user_id, refund.as_i64()).await {
                                let _ = client_tx.send(axum::extract::ws::Message::Text(serde_json::to_string(&serde_json::json!({"type":"BalanceUpdated","balance":new_balance})).unwrap().into()));
                            }
                        }
                    });
                }
                Err(e) => { send_error(client_tx, None, None, &format!("Kick vote failed: {:?}", e)); }
            }
        }
        "kick_vote_yes" => {
            let room_id = parsed.get("room_id").and_then(|t| t.as_str()).and_then(|s| s.parse::<TableId>().ok());
            let kick_vote_id = parsed.get("kick_vote_id").and_then(|t| t.as_str()).and_then(|s| Uuid::parse_str(s).ok());
            if let Err(e) = state.registry.vote_kick_yes(room_id.unwrap(), *user_id, kick_vote_id.unwrap()).await {
                send_error(client_tx, None, None, &format!("Vote failed: {:?}", e));
            }
        }
        _ => {}
    }
    true
}
