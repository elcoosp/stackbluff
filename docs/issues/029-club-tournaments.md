---
title: Club tournament scheduling and automatic result posting
labels: backend, clubs, tournament, afk
blocked_by: 014, 024, 027
---

## What to build

Complete club tournament feature in `sb-club` and `sb-tournament` crates (REQ-FUNC-043, REQ-FUNC-035):

- `POST /clubs/{id}/tournaments` – schedule a tournament with date/time, blind template ID, max players, buy‑in (chips). Returns tournament ID.
- Club members can register via `POST /tournaments/{id}/register`.
- Tournament run using MTT logic (#024) but restricted to club members (`club_id` check).
- After tournament ends, use `NotificationService` to trigger a result post to club’s linked Telegram group (if club has `telegram_group_id` set).
- Post includes top 3 placements, winning hand summary, and a “Join next tournament” invite link.

## Acceptance criteria

- [ ] Club owner schedules tournament via API; tournament appears in `GET /clubs/{id}/tournaments`.
- [ ] Registered members receive reminders (#028).
- [ ] Result post appears in Telegram group within 10 seconds of final hand.
- [ ] Leaderboard updated with XP earned from tournament play (integrate with #014).

## Blocked by

#014 (club system), #024 (MTT logic), #027 (bot posting)
