---
title: Daily missions and streak system
labels: backend, missions, afk
blocked_by: 001, 002, 004
---

## What to build

Implement mission module (Agent 1) behind `MissionApi`:

- At 00:00 UTC, assign 3 missions per player from a pool of ≥30 mission types (e.g., “Win a hand with a flush”, “Bluff successfully 2 times”).
- Track completions in `mission_completions` table.
- When all 3 missions complete, award chip bonus.
- Maintain 7‑day streak counter; on 7th consecutive day, award “Streak Shield” bonus (5× daily reward).
- Expose `GET /missions/today` and `POST /missions/claim` endpoints.

## Acceptance criteria

- [ ] Player sees 3 distinct missions per day.
- [ ] Completing all 3 triggers chip award within 5 seconds.
- [ ] Streak persists across days; missing a day resets streak to 0.
- [ ] 7‑day streak bonus awarded only once per week.

## Blocked by

#001 (contracts – MissionApi), #002 (mission_completions table), #004 (user identification)
