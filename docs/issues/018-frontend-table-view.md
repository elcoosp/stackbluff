---
title: Frontend table view – WebSocket integration and game UI
labels: frontend, ui, websocket, afk
blocked_by: 005, 006, 009
---

## What to build

Agent 2 implements the table view for both PWA and Mini App:

- `TablePage` component that connects to `wss://host/ws/game` using JWT (stored in Zustand store).
- On mount, sends `join_table` message with `table_id`.
- Handles incoming messages (types from `sb-ws-messages` – generated from asyncapi.yaml):
  - `table.state` – full state snapshot.
  - `hand.dealt` – hole cards for current player.
  - `action.required` – enables action buttons, shows timer.
  - `action.broadcast` – opponent actions.
  - `hand.result` – showdown, winners.
- Renders poker table UI using shadcn/ui and tailwind custom CSS (cards, chips, pot).
- Action buttons: fold, check/call, raise slider (with min/max limits from server).
- Timer bar counts down based on `remaining_ms`.

## Acceptance criteria

- [ ] Joining a table shows correct seat, stack, hole cards (only for current player).
- [ ] Timer bar counts down smoothly; auto‑submit on expiry (but server is authoritative).
- [ ] Player actions sent via WebSocket reflect in UI within 500ms.
- [ ] Disconnect/reconnect re‑subscribes and receives full state sync.

## Blocked by

#005 (WebSocket baseline), #006 (frontend scaffold), #009 (table actor loop)
