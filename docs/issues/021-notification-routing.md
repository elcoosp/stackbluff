---
title: Notification routing – Telegram Bot API vs Web Push
labels: backend, notifications, afk
blocked_by: 001, 004, 006
---

## What to build

Implement the notification module (Agent 3) behind `NotificationApi`:

- For users registered via Telegram Mini App, send notifications via Telegram Bot API (DM).
- For PWA users with consent, send via Web Push (using `web-push` crate).
- Store user’s platform preference in `users.platform` (telegram / pwa) and `push_subscription` JSON for PWA.
- Expose `POST /notifications/subscribe` for PWA to store subscription.
- All internal events (tournament reminder, streak alert, referral conversion) call `NotificationApi::send`.

## Acceptance criteria

- [ ] Telegram user receives a DM when referral bonus credited.
- [ ] PWA user with consent receives browser push notification.
- [ ] Unsubscribed PWA users receive no notification.
- [ ] Integration test: event triggers → correct delivery path used.

## Blocked by

#001 (contracts – NotificationApi), #004 (user platform detection), #006 (frontend can request permission)
