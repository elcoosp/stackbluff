---
title: Table actor minimal loop – fold, call, raise stubs with state machine
labels: backend, game-engine, afk
blocked_by: 003, 005
---

## What to build

Implement a minimal but functional table actor (Agent 1) that can:

- Maintain `TableState` (seats, players, current hand, pot, community cards).
- Receive messages via `mpsc::Receiver` from the WebSocket handler.
- Process `action.fold`, `action.call`, `action.raise`, `action.check` (basic validation: does player have enough chips?).
- Broadcast state changes to all connected players via `broadcast::Sender`.
- Timer stub: after 30 seconds without action, auto‑fold (just print to logs for now – full timer comes later).

## Acceptance criteria

- [ ] Two players can sit at a table, post blinds, and execute a fold – hand ends, next hand starts.
- [ ] Raise amount is deducted from stack and added to pot.
- [ ] State is broadcast to all clients correctly (no hole cards leaked).
- [ ] Unit test: player raises, second player calls → community cards appear.

## Blocked by

#003 (hand evaluator needed for showdown), #005 (WebSocket plumbing)
