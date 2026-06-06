---
title: Discord bot integration – tournament results and club leaderboard posts
labels: backend, discord, bot, afk
blocked_by: 001, 021, 029
---

## What to build

Implement Discord bot (TBD-002) as an extension of `NotificationApi`:

- New `DiscordNotifier` implementing `NotificationApi`.
- Club owners can link a Discord channel via `/discord link #channel` command.
- Bot posts:
  - Tournament result summaries (top 3, winning hand) automatically after club tournament ends.
  - Daily leaderboard snapshot (top 10) at 09:00 UTC.
  - Streak alerts and referral milestones (optional per‑club setting).
- Use Discord webhooks or bot token for message delivery.
- Commands: `/discord link`, `/discord unlink`, `/discord settings`.

## Acceptance criteria

- [ ] Club owner links Discord channel → bot joins channel and posts confirmation.
- [ ] After club tournament, bot posts result within 30 seconds.
- [ ] Daily leaderboard post appears at 09:00 UTC.
- [ ] Commands respond with ephemeral messages confirming action.

## Blocked by

#001 (NotificationApi extension), #021 (notification routing), #029 (club tournament results)
