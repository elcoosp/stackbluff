---
title: Table actor – complete betting loop with state machine, no persistence
labels: backend, game-engine, afk
blocked_by: 003, 005
---

## What to build

Implement the **table actor** inside `sb-table-registry/src/actor.rs` (Agent 1):

- Spawned task that owns the game state (players, stack sizes, current hand).
- Receives `TableCommand` via `mpsc::Receiver`.
- Implements the full betting round logic using `sb-game-engine` for hand progression.
- On actions (fold/call/raise/check), validates (stack sufficiency, correct turn) and updates state.
- Broadcasts state changes to all connected players via `broadcast::Sender` (from `sb-ws-handler`).
- Timer stub: after 30 seconds without action, auto‑fold (implemented but note: no time bank yet – that’s #011).
- **No database writes in this issue** – persistence will be added in #010 and #011.

## Acceptance criteria

- [ ] Two players can sit at a table, post blinds, and complete a full hand (fold, call, raise, showdown).
- [ ] Raises correctly deduct chips and add to pot.
- [ ] Broadcast messages (`table.state`, `action.required`, `hand.result`) contain no hole cards for other players.
- [ ] Unit test: player raises, second player calls → community cards appear and hand resolves.

## Blocked by

#003 (game engine – for hand resolution), #005 (WebSocket plumbing – for broadcasting)
