---
title: Club tournament scheduling and automatic result posting
labels: backend, clubs, tournament, afk
blocked_by: 014, 024, 027
---

## What to build

Complete club tournament feature (REQ-FUNC-043, REQ-FUNC-035):

- `POST /clubs/{id}/tournaments` – schedule a tournament with date/time, blind template, max players, buy‑in (chips).
- Club members can register via `POST /tournaments/{id}/register`.
- Tournament run using MTT logic (#024) but restricted to club members.
- After tournament ends, bot posts results to club’s linked Telegram group (if club has set a `telegram_group_id`).
- Post includes top 3 placements, winning hand, and a “Join next tournament” invite link.

## Acceptance criteria

- [ ] Club owner schedules tournament in ≤ 2 minutes via UI (frontend later).
- [ ] Registered members receive reminders (#028).
- [ ] Result post appears in Telegram group within 10 seconds of final hand.
- [ ] Leaderboard updated with XP earned from tournament play.

## Blocked by

#014 (clubs exist), #024 (MTT logic), #027 (bot posting)
