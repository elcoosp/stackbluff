---
title: WebSocket baseline – connection upgrade and table registry stub
labels: backend, websocket, afk
blocked_by: 001, 004
---

## What to build

Create the WebSocket handler and the table registry skeleton (Agent 1):

- Axum route `GET /ws/game` – upgrades connection after JWT validation (extract token from `Authorization` header).
- `TableRegistry` struct with a `HashMap<TableId, mpsc::Sender<TableCommand>>` and methods `create_table`, `join_table` (stubs that just log).
- On successful upgrade, spawn a `WebSocketConnection` task that reads messages and forwards them to the appropriate table actor (routing by `table_id` field).
- Ping/pong every 30 seconds; disconnect after 10 seconds no pong.

## Acceptance criteria

- [ ] Unauthenticated WebSocket upgrade attempt returns HTTP 401.
- [ ] Authenticated connection stays alive for 2 minutes with pings.
- [ ] Sending `{"type":"ping"}` receives `{"type":"pong"}`.
- [ ] TableRegistry returns a placeholder `TableId` on `create_table`; no actual game logic yet.

## Blocked by

#001 (contracts – TableApi trait), #004 (JWT auth needed)
