use axum::{extract::WebSocketUpgrade, response::{IntoResponse, Response}, routing::get, Router};
use axum::body::Bytes;
use axum::http::{Request, header, StatusCode};
use futures::{SinkExt, StreamExt};
use sb_auth::validate_token;
use tokio::time::{self, Duration};
use tracing::{info, warn, error};

pub fn ws_route() -> Router {
    Router::new().route("/ws/game", get(ws_handler))
}

async fn ws_handler(ws: WebSocketUpgrade, req: Request<axum::body::Body>) -> Response {
    let token = req.headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or((StatusCode::UNAUTHORIZED, "Missing or invalid token"));
    let token = match token { Ok(t) => t, Err(r) => return r.into_response() };
    let user_id = match validate_token(token) {
        Ok(uid) => uid,
        Err(e) => {
            warn!(error = %e, "JWT validation failed");
            return (StatusCode::UNAUTHORIZED, "Invalid token").into_response();
        }
    };
    info!(%user_id, "WebSocket upgrade authenticated");
    ws.on_upgrade(handle_websocket)
}

async fn handle_websocket(socket: axum::extract::ws::WebSocket) {
    let (mut sender, mut receiver) = socket.split();
    let mut ping_interval = time::interval(Duration::from_secs(30));
    loop {
        tokio::select! {
            _ = ping_interval.tick() => {
                if sender.send(axum::extract::ws::Message::Ping(Bytes::new())).await.is_err() { break; }
                let timeout = tokio::time::sleep(Duration::from_secs(10));
                tokio::pin!(timeout);
                tokio::select! {
                    _ = &mut timeout => { warn!("No pong, disconnecting"); break; }
                    msg = receiver.next() => {
                        if let Some(Ok(axum::extract::ws::Message::Pong(_))) = msg { /* pong received */ }
                    }
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
                Some(Ok(axum::extract::ws::Message::Close(_))) => break,
                Some(Ok(axum::extract::ws::Message::Binary(_))) => { /* ignore binary messages */ }
                Some(Ok(axum::extract::ws::Message::Ping(data))) => {
                    let _ = sender.send(axum::extract::ws::Message::Pong(data)).await;
                }
                Some(Ok(axum::extract::ws::Message::Pong(_))) => { /* pong already handled by tick loop */ }
                Some(Err(e)) => { error!(%e, "WebSocket error"); break; }
                None => break,
            }
        }
    }
}
