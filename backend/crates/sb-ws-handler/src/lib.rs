use axum::{
    extract::WebSocketUpgrade,
    response::Response,
    routing::get,
    Router,
};
use axum::http::{Request, header};
use futures::{SinkExt, StreamExt};
use sb_auth::validate_token;
use sb_shared_types::UserId;
use tokio::time::{self, Duration};
use tracing::{info, warn, error};

pub fn ws_route() -> Router {
    Router::new().route("/ws/game", get(ws_handler))
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    req: Request<axum::body::Body>,
) -> Response {
    let auth_header = req.headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());

    let token = match auth_header {
        Some(h) if h.starts_with("Bearer ") => &h[7..],
        _ => {
            return (axum::http::StatusCode::UNAUTHORIZED, "Missing or invalid Authorization header").into_response();
        }
    };

    let user_id = match validate_token(token) {
        Ok(uid) => uid,
        Err(e) => {
            warn!(error = %e, "JWT validation failed");
            return (axum::http::StatusCode::UNAUTHORIZED, "Invalid token").into_response();
        }
    };

    info!(user_id = %user_id, "WebSocket upgrade request authenticated");
    ws.on_upgrade(move |socket| handle_websocket(socket, user_id))
}

async fn handle_websocket(socket: axum::extract::ws::WebSocket, user_id: UserId) {
    let (mut sender, mut receiver) = socket.split();

    let mut ping_interval = time::interval(Duration::from_secs(30));
    let mut last_pong = tokio::time::Instant::now();

    loop {
        tokio::select! {
            _ = ping_interval.tick() => {
                if sender.send(axum::extract::ws::Message::Ping(vec![])).await.is_err() {
                    break;
                }
                let timeout = tokio::time::sleep(Duration::from_secs(10));
                tokio::pin!(timeout);
                tokio::select! {
                    _ = &mut timeout => {
                        warn!("No pong received, disconnecting");
                        break;
                    }
                    msg = receiver.next() => {
                        match msg {
                            Some(Ok(axum::extract::ws::Message::Pong(_))) => {
                                last_pong = tokio::time::Instant::now();
                            }
                            _ => {}
                        }
                    }
                }
            }
            msg = receiver.next() => {
                match msg {
                    Some(Ok(axum::extract::ws::Message::Text(text))) => {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                            if json.get("type").and_then(|t| t.as_str()) == Some("ping") {
                                let _ = sender.send(axum::extract::ws::Message::Text(r#"{"type":"pong"}"#.into())).await;
                            }
                        }
                    }
                    Some(Ok(axum::extract::ws::Message::Close(_))) => break,
                    Some(Err(e)) => {
                        error!(error = %e, "WebSocket error");
                        break;
                    }
                    None => break,
                }
            }
        }
    }
}
