---
title: Club system – creation, membership, and leaderboard
labels: backend, clubs, afk
blocked_by: 001, 002, 007
---

## What to build

Implement Club module (Agent 1) with:

- `POST /clubs` – create club (name, optional logo).
- `POST /clubs/{id}/join` – join club (link‑based).
- `GET /clubs/{id}/leaderboard` – returns weekly XP ranking (max 500 rows; if >500 members, partition into divisions).
- Database tables: `clubs`, `club_memberships`, `club_leaderboard_cache` (materialised view refreshed every 5 minutes).
- XP is earned when members play any hand at a club‑owned table.

## Acceptance criteria

- [ ] Club creation completes in ≤ 3 interactions.
- [ ] Leaderboard for club with 600 members returns first division (rows 1‑500) and second division link.
- [ ] Joining a club via invite link works and XP starts accruing.
- [ ] Integration test: play a hand → club leaderboard reflects XP within 5 minutes.

## Blocked by

#001 (contracts – ClubApi), #002 (database tables exist), #007 (table creation can associate club_id)
