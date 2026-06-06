---
title: Daily missions and streak system
labels: backend, missions, afk
blocked_by: 001, 002, 004
---

## What to build

Implement `sb-mission` crate (Agent 4) behind `MissionService` trait:

- At 00:00 UTC, assign 3 missions per player from a pool of ≥30 mission types (e.g., “Win a hand with a flush”, “Bluff successfully 2 times”).
- Track completions in `mission_completions` table (user_id, mission_type, completed_date).
- When all 3 missions complete, award chip bonus via `UserService::award_chips`.
- Maintain 7‑day streak counter in `users.streak_count`. Increment daily if at least one mission completed.
- On 7th consecutive day, award “Streak Shield” bonus (5× daily reward). Then reset streak? No – keep counting but award only once per week (reset award flag weekly).
- Expose `GET /missions/today` and `POST /missions/claim` endpoints.

## Acceptance criteria

- [ ] Player sees 3 distinct missions per day (different missions across days).
- [ ] Completing all 3 triggers chip award within 5 seconds.
- [ ] Streak persists across days; missing a day resets streak to 0.
- [ ] 7‑day streak bonus awarded only once per week (not again on day 14).

## Blocked by

#001 (contracts – MissionService), #002 (mission_completions table), #004 (user identification)
