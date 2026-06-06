---
title: Notification routing – Telegram Bot API vs Web Push
labels: backend, notifications, afk
blocked_by: 001, 004, 006
---

## What to build

Implement `sb-notification` crate (Agent 3) behind `NotificationService` trait:

- For users registered via Telegram Mini App (`platform = 'telegram'`), send notifications via Telegram Bot API (DM).
- For PWA users with consent (`platform = 'pwa'` and `push_subscription` stored), send via Web Push (using `web-push` crate).
- Store user’s push subscription JSON in `users.push_subscription` (nullable).
- Expose `POST /notifications/subscribe` for PWA to store/update subscription.
- All internal events (tournament reminder, streak alert, referral conversion) call `NotificationService::send(user_id, event)`.
- Event types: `TournamentReminder`, `StreakAlert`, `ReferralBonus`, `MissionComplete`, etc.

## Acceptance criteria

- [ ] Telegram user receives a DM when referral bonus credited.
- [ ] PWA user with consent receives browser push notification.
- [ ] Unsubscribed PWA users receive no notification (graceful skip).
- [ ] Integration test: event triggers → correct delivery path used.

## Blocked by

#001 (contracts – NotificationService), #004 (user platform detection), #006 (frontend can request permission)
