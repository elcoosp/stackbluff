---
title: Speed Poker / Zoom mode – quick fold and fast table rotation
labels: backend, frontend, game-engine, afk
blocked_by: 009, 018
---

## What to build

Implement Speed Poker (SN-009 – Should Have, deferred to Wave 4):

- New table type: `speed_poker` with 6 seats.
- Players can pre‑select action (fold, check/call) before their turn. If action set, it executes instantly when turn arrives (no timer wait).
- When a player folds, they are immediately moved to a new table (re‑queued) and dealt new cards – no waiting for hand to finish.
- Backend maintains a pool of waiting players and fills tables rapidly.
- Client shows "Next hand" queue position after folding.
- Same WebSocket protocol, with new `action.pre_select` message.

## Acceptance criteria

- [ ] Player selects "Fold any hand" – auto‑folds instantly on each deal.
- [ ] After folding, player rejoins queue and sees new table within 5 seconds.
- [ ] Speed tables handle 3x the hand volume of normal tables.
- [ ] Leaderboard counts Speed Poker chips same as normal.

## Blocked by

#009 (table actor loop), #018 (frontend table view)
