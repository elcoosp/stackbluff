use axum::body::Bytes;
use axum::http::{Request, StatusCode, header};
use axum::{
    Router,
    extract::{State, WebSocketUpgrade},
    response::{IntoResponse, Response},
    routing::get,
};
use futures::{SinkExt, StreamExt};
use sb_auth::Authenticator;
use sb_table_registry::Registry;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::time::{self, Duration, Instant};
use tracing::{error, info, warn};

pub type BroadcastSender<T> = broadcast::Sender<T>;
pub type BroadcastReceiver<T> = broadcast::Receiver<T>;

pub fn broadcast_channel<T: Clone>(capacity: usize) -> (BroadcastSender<T>, BroadcastReceiver<T>) {
    broadcast::channel(capacity)
}

struct AppState {
    auth: Arc<dyn Authenticator>,
    registry: Registry,
}

pub fn ws_route(auth: Arc<dyn Authenticator>, registry: Registry) -> Router {
    let state = Arc::new(AppState { auth, registry });
    Router::new()
        .route("/ws/game", get(ws_handler))
        .with_state(state)
}

#[axum::debug_handler]
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    req: Request<axum::body::Body>,
) -> Response {
    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or((StatusCode::UNAUTHORIZED, "Missing or invalid token"));
    let token = match token {
        Ok(t) => t,
        Err(r) => return r.into_response(),
    };
    let user_id = match state.auth.validate_token(token).await {
        Ok(uid) => uid,
        Err(e) => {
            warn!(error = %e, "JWT validation failed");
            return (StatusCode::UNAUTHORIZED, "Invalid token").into_response();
        }
    };
    info!(%user_id, "WebSocket upgrade authenticated");
    let registry = state.registry.clone();
    ws.on_upgrade(move |socket| handle_websocket(socket, registry))
}

async fn handle_websocket(socket: axum::extract::ws::WebSocket, _registry: Registry) {
    let (mut sender, mut receiver) = socket.split();
    let mut ping_interval = time::interval(Duration::from_secs(30));
    let mut last_pong = Instant::now();
    let mut timeout_check = time::interval(Duration::from_secs(5));

    loop {
        tokio::select! {
            _ = ping_interval.tick() => {
                if sender.send(axum::extract::ws::Message::Ping(Bytes::new())).await.is_err() {
                    break;
                }
            }
            _ = timeout_check.tick() => {
                if last_pong.elapsed() > Duration::from_secs(10) {
                    warn!("No pong received for 10s, disconnecting");
                    let _ = sender.send(axum::extract::ws::Message::Close(None)).await;
                    break;
                }
            }
            msg = receiver.next() => match msg {
                Some(Ok(axum::extract::ws::Message::Text(text))) => {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text)
                        && json.get("type").and_then(|t| t.as_str()) == Some("ping")
                    {
                        let _ = sender.send(axum::extract::ws::Message::Text(r#"{"type":"pong"}"#.into())).await;
                    }
                }
                Some(Ok(axum::extract::ws::Message::Pong(_))) => {
                    last_pong = Instant::now();
                }
                Some(Ok(axum::extract::ws::Message::Close(frame))) => {
                    let _ = sender.send(axum::extract::ws::Message::Close(frame)).await;
                    break;
                }
                Some(Ok(axum::extract::ws::Message::Binary(_))) => { /* ignore */ }
                Some(Ok(axum::extract::ws::Message::Ping(data))) => {
                    let _ = sender.send(axum::extract::ws::Message::Pong(data)).await;
                }
                Some(Err(e)) => {
                    error!(%e, "WebSocket error");
                    let _ = sender.send(axum::extract::ws::Message::Close(None)).await;
                    break;
                }
                None => break,
            }
        }
    }
}
