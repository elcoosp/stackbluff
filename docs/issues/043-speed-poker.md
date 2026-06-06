---
title: Speed Poker / Zoom mode – quick fold and fast table rotation
labels: backend, frontend, game-engine, afk
blocked_by: 009, 018
---

## What to build

Implement Speed Poker (SN-009 – Should Have, deferred to Wave 4):

- **Backend** (`sb-table-registry` + `sb-game-engine`):
  - New table type: `TableConfig::SpeedPoker` with 6 seats.
  - Players can pre‑select action (fold, check/call) before their turn via `action.pre_select`. If action set, it executes instantly when turn arrives (no timer wait).
  - When a player folds or leaves, they are immediately moved to a waiting queue. When enough players in queue, form a new table (or fill existing).
  - Backend maintains a `SpeedQueue` (per stake level) that assigns players to tables as they become available.
- **Frontend** (Agent 2):
  - UI for Speed Poker table: show "Pre‑select action" toggle.
  - After folding, show queue position and "Next hand" countdown.
  - Same rendering as normal table.

## Acceptance criteria

- [ ] Player selects "Fold any hand" – auto‑folds instantly on each deal.
- [ ] After folding, player rejoins queue and sees new table within 5 seconds.
- [ ] Speed tables handle 3× the hand volume of normal tables (benchmark).
- [ ] Leaderboard counts Speed Poker chips same as normal (no separate leaderboard).

## Blocked by

#009 (table actor loop), #018 (frontend table view)
