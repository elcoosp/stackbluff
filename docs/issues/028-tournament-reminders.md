---
title: Tournament reminders – 60min and 10min before start
labels: backend, tournament, notifications, afk
blocked_by: 023, 021
---

## What to build

Add tournament reminder scheduling (REQ-FUNC-034, REQ-FUNC-044):

- When a tournament (S&G or MTT) is created with a future start time, schedule two reminder jobs.
- 60 minutes before: send notification (Telegram DM for Mini App users, Web Push for PWA) to all registered participants.
- 10 minutes before: send another reminder with a deep link to the tournament lobby.
- Use `tokio` timers or a persistent job queue (e.g., `cron`‑like scheduler in Rust).
- For club tournaments (#029), also post reminder to the linked Telegram group.

## Acceptance criteria

- [ ] Tournament scheduled for 14:00 → participant receives notification at 13:00 and 13:50.
- [ ] Reminder includes tournament name, start time, and one‑tap join link.
- [ ] If user unregisters before reminder, they are removed from notification list.

## Blocked by

#023 (tournament creation), #021 (notification routing)
