---
title: Spectator mode – watch tables and live chat
labels: backend, frontend, websocket, afk
blocked_by: 018, 021
---

## What to build

Implement spectator mode (SN-016):

- Unauthenticated users can view a table via `GET /spectate/{table_id}` (read‑only).
- Spectators see same state as players except hole cards (hidden).
- Spectators can send chat messages (rate‑limited) that are broadcast to all spectators and players (opt‑in for players).
- Chat messages have `type: "chat"` and include sender name.
- Table actors maintain a separate broadcast channel for spectators (no game actions).
- Max spectators per table: configurable (default 100).
- Frontend: spectator UI with chat panel and table view (no action buttons).

## Acceptance criteria

- [ ] Anonymous user can watch any active table without login.
- [ ] Chat messages appear within 500ms.
- [ ] Players can disable chat via settings.
- [ ] Spectator count displayed on table lobby card.

## Blocked by

#018 (frontend table view), #021 (notification routing for chat)
