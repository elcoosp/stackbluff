---
title: Telegram bot – post game result summary to originating group
labels: backend, telegram, bot, afk
blocked_by: 001, 013
---

## What to build

Implement result posting (REQ-FUNC-032, REQ-FUNC-033):

- When a game session started via `/poker` ends (all players leave or table closes), the bot posts a summary to the same Telegram group.
- Summary includes: winner name, winning hand (text), chip amounts, and an embedded invite link.
- Invite link, when clicked by a non‑registered user, begins registration and attributes referral to the player who originally invoked `/poker`.
- Result post appears within 5 seconds of session end.

## Acceptance criteria

- [ ] After a 3‑hand session, bot posts “@Alice won 12,000 chips with Two Pair – Aces and Kings”.
- [ ] Invite link correctly registers new users and credits Alice as referrer.
- [ ] No post if the group was deleted or bot removed – logged as warning.

## Blocked by

#001 (NotificationApi), #013 (bot webhook exists)
