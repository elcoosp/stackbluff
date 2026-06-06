---
title: Tournament reminders – 60min and 10min before start
labels: backend, tournament, notifications, afk
blocked_by: 023, 021
---

## What to build

Add tournament reminder scheduling in `sb-tournament` crate (REQ-FUNC-034, REQ-FUNC-044):

- When a tournament (S&G or MTT) is created with a future start time (`scheduled_start`), schedule two background tasks (using `tokio::spawn` with `tokio::time::sleep_until`).
- 60 minutes before: call `NotificationService::send` with `TournamentReminder` event for all registered participants.
- 10 minutes before: send another reminder with a deep link to the tournament lobby.
- For club tournaments, also post reminder to the linked Telegram group (via `sb-bot-handler`).
- Persist scheduled jobs in memory; on server restart, reschedule from `tournaments` table where `status = 'scheduled'`.

## Acceptance criteria

- [ ] Tournament scheduled for 14:00 → participant receives notification at 13:00 and 13:50.
- [ ] Reminder includes tournament name, start time, and one‑tap join link.
- [ ] If user unregisters before reminder, they are removed from notification list (job checks current registrations).

## Blocked by

#023 (tournament creation), #021 (notification routing)
