---
title: Spectator mode – watch tables and live chat
labels: backend, frontend, websocket, afk
blocked_by: 018, 021
---

## What to build

Implement spectator mode (SN-016) – Agent 2 + Agent 3:

- **Backend** (`sb-ws-handler` + `sb-notification`):
  - New WebSocket endpoint `wss://host/ws/spectate/{table_id}` that does not require authentication.
  - Spectators receive a filtered view of table state (no hole cards, only public info).
  - Chat messages: spectators can send `chat.message` (rate‑limited: 5 messages per 10 seconds). Chat is broadcast to all spectators and (opt‑in) to players.
  - Max spectators per table: configurable (default 100). When limit reached, new connections rejected.
- **Frontend**:
  - Spectator page (`/spectate/{table_id}`) with table render (same as table view but no action buttons) and chat panel.
  - Players can disable chat via settings (flag `chat_enabled` in user settings).

## Acceptance criteria

- [ ] Anonymous user can watch any active table without login.
- [ ] Chat messages appear within 500ms.
- [ ] Players can disable chat via settings (chat messages not delivered to them).
- [ ] Spectator count displayed on table lobby card.

## Blocked by

#018 (frontend table view), #021 (notification routing for chat)
