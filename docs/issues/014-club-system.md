---
title: Club system – creation, membership, and leaderboard
labels: backend, clubs, afk
blocked_by: 001, 002, 007
---

## What to build

Implement `sb-club` crate (Agent 3) with:

- `POST /clubs` – create club (name, optional logo). Returns `club_id`.
- `POST /clubs/{id}/join` – join club (link‑based). Requires authentication.
- `GET /clubs/{id}/leaderboard` – returns weekly XP ranking (max 500 rows; if >500 members, partition into divisions – see #035).
- Database tables already defined in #002; add methods in `ClubRepo` (to be implemented in `sb-db-repos`).
- XP earned: when a club member plays any hand at a club‑owned table, increment `club_memberships.weekly_xp`.
- Leaderboard materialised view refreshed every 5 minutes (scheduled job in `sb-server`).

## Acceptance criteria

- [ ] Club creation completes in ≤ 3 API calls.
- [ ] Leaderboard for club with 600 members returns first division (rows 1‑500) and metadata about second division.
- [ ] Joining a club via invite link works and XP starts accruing.
- [ ] Integration test: play a hand → club leaderboard reflects XP within 5 minutes.

## Blocked by

#001 (contracts – ClubService), #002 (database tables exist), #007 (table creation can associate club_id)
