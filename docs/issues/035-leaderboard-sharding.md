---
title: Leaderboard division sharding for clubs exceeding 500 members
labels: backend, clubs, performance, afk
blocked_by: 014
---

## What to build

Implement division sharding in `sb-club` crate (REQ-FUNC-042, BR-014):

- When a club reaches 501 members, automatically split members into divisions of ≤500.
- Divisions are numbered (Division 1, Division 2, …) based on join order.
- Each division has its own leaderboard (ranked by weekly XP).
- `GET /clubs/{id}/leaderboard` accepts query param `?division=1` (default 1). Also returns `total_divisions` in response.
- Club owners can view any division’s leaderboard via UI (dropdown).
- Members see which division they belong to on club page.
- XP earned moves member up only within their division.
- If a club grows to 1000 members, divisions are rebalanced (simple: reassign all members round‑robin, but only on request or weekly job).

## Acceptance criteria

- [ ] Club with 501 members: division 1 has 500 members, division 2 has 1 member.
- [ ] Leaderboard query for division 1 returns exactly 500 rows in < 100ms.
- [ ] XP earned moves member up only within their division.
- [ ] Rebalancing job (if triggered) correctly redistributes.

## Blocked by

#014 (club leaderboard exists)
