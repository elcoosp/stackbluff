---
title: WebSocket upgrade, connection management, and table registry skeleton
labels: backend, websocket, afk
blocked_by: 001, 004
---

## What to build

Create two crates:

**`sb-ws-handler`**:
- Axum route `GET /ws/game` – upgrades connection after JWT validation (extract token from `Authorization` header).
- Spawns a `WebSocketConnection` task per client.
- Forwards messages to the appropriate table actor using `TableRegistry` handle.
- Ping/pong every 30 seconds; disconnect after 10 seconds no pong.

**`sb-table-registry`**:
- `Registry` struct with a `HashMap<TableId, mpsc::Sender<TableCommand>>`.
- `create_table(config) -> TableId` – spawns a new `table_actor` task (stub that just logs), stores its sender.
- `join_table(table_id, player_id)` – sends a `Join` command to the actor.
- Reaper task: periodically cleans up stale connections (no heartbeat).

**Note:** The table actor itself will be fully implemented in #009; this issue creates only the scaffolding.

## Acceptance criteria

- [ ] Unauthenticated WebSocket upgrade returns HTTP 401.
- [ ] Authenticated connection stays alive with ping/pong.
- [ ] `create_table` spawns a task and returns a `TableId`; actor logs "table created".
- [ ] Sending `{"type":"ping"}` over WS returns `{"type":"pong"}`.

## Blocked by

#001 (contracts – TableService trait, TableCommand types), #004 (JWT auth)
