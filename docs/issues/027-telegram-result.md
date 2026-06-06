---
title: Telegram bot – post game result summary to originating group
labels: backend, telegram, bot, afk
blocked_by: 001, 013
---

## What to build

Enhance `sb-bot-handler` crate to post game results (REQ-FUNC-032, REQ-FUNC-033):

- When a game session started via `/poker` ends (all players leave or table closes), the bot posts a summary to the same Telegram group.
- Summary includes: winner name, winning hand (human‑readable), chip amounts, and an embedded invite link.
- Invite link includes `?ref=<inviter_user_id>` for referral attribution (to the player who invoked `/poker`).
- Result post appears within 5 seconds of session end (listen to `TableEvent::SessionClosed` via `NotificationService`).

## Acceptance criteria

- [ ] After a 3‑hand session, bot posts “@Alice won 12,000 chips with Two Pair – Aces and Kings”.
- [ ] Invite link correctly registers new users and credits Alice as referrer (test with e2e).
- [ ] No post if the group was deleted or bot removed – logged as warning (no crash).

## Blocked by

#001 (NotificationService), #013 (bot webhook exists)
