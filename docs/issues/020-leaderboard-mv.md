---
title: Leaderboard – materialised view and optimistic client updates
labels: backend, frontend, leaderboard, afk
blocked_by: 002, 018
---

## What to build

**Backend** (Agent 1 extension to `sb-db-repos` and `sb-rest-router`):
- Create SQLite materialised view `leaderboard_global_mv` that ranks users by `total_chips_won` (derived from hand_history).
- Scheduled background job (in `sb-server`) refreshes the view every 5 minutes.
- REST endpoint `GET /leaderboard/global` returns top 100 users (user_id, display_name, total_chips_won, rank).
- Optional query param `?offset=100` for pagination.

**Frontend** (Agent 2):
- On lobby load, fetch leaderboard and display.
- On hand completion (`hand.result`), client optimistically updates the displayed leaderboard using the known chip delta.
- After materialised view refresh (poll every 5 minutes), reconcile server state.

## Acceptance criteria

- [ ] Materialised view refresh completes within 30 seconds for 10k users.
- [ ] After winning 50k chips, client shows estimated rank within 500ms; after ≤5 minutes server rank matches.
- [ ] Club leaderboard (already in #014) also uses optimistic pattern.
- [ ] No duplicate or conflicting updates.

## Blocked by

#002 (hand_history table exists), #018 (frontend can intercept hand.result)
