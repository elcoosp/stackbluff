---
title: Frontend table view – WebSocket integration and game UI
labels: frontend, ui, websocket, afk
blocked_by: 005, 006, 009
---

## What to build

Agent 2 implements the table view for both PWA and Mini App:

- `TablePage` component that connects to `wss://host/ws/game` using JWT.
- On mount, sends `join_table` message with `table_id`.
- Handles incoming messages: `table.state`, `hand.dealt`, `action.required`, `action.broadcast`, `hand.result`.
- Renders poker table UI (seats, cards, chips, pot) using shadcn/ui and custom CSS.
- Action buttons (fold, check/call, raise slider) enabled only when `action.required` received.
- Uses Zustand store to keep local state and optimistically update on own actions.

## Acceptance criteria

- [ ] Joining a table shows correct seat, stack, hole cards (only for current player).
- [ ] Timer bar counts down based on `remaining_ms` from server.
- [ ] Player actions sent via WebSocket reflect in UI within 500ms.
- [ ] Disconnect/reconnect re‑subscribes and receives full state sync.

## Blocked by

#005 (WebSocket baseline), #006 (frontend monorepo), #009 (table actor loop)
