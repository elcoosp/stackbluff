---
title: Leaderboard – materialised view and optimistic client updates
labels: backend, frontend, leaderboard, afk
blocked_by: 002, 018
---

## What to build

Implement global leaderboard (backend Agent 1, frontend Agent 2):

- SQLite materialised view `leaderboard_global_mv` refreshed every 5 minutes by a scheduled background job.
- REST endpoint `GET /leaderboard/global` returns top 100 users (user_id, display_name, total_chips_won, rank).
- Frontend calls this on lobby load and every 5 minutes thereafter.
- On hand completion, client optimistically updates the displayed leaderboard using the known chip delta before the materialised view refresh.

## Acceptance criteria

- [ ] Materialised view refresh completes within 30 seconds for 10k users.
- [ ] After winning 50k chips, client shows estimated rank within 500ms; after ≤5 minutes server rank matches.
- [ ] Club leaderboard uses same pattern (already covered in #014 but this adds optimism).
- [ ] No duplicate or conflicting updates.

## Blocked by

#002 (tables needed for leaderboard calculation), #018 (frontend can intercept hand.result)
