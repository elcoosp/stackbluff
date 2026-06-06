---
title: Web Push consent prompt and subscription management
labels: frontend, notifications, afk
blocked_by: 006, 021
---

## What to build

Implement Web Push consent flow for PWA (REQ-FUNC-111, REQ-NFR-COMP-001):

- On first game completion, show a non‑intrusive prompt (e.g., “Get tournament reminders and streak alerts”) with Allow/Deny.
- If user allows, call `Notification.requestPermission()` and send subscription to `POST /notifications/subscribe`.
- If user denies, never prompt again (store in localStorage).
- Provide a settings page where user can enable/disable notifications (re‑prompt or direct update subscription).
- For compliance, also implement a cookie consent banner (REQ-NFR-COMP-001) that must be accepted before any non‑essential tracking (analytics). Use a simple modal that stores consent in localStorage.

## Acceptance criteria

- [ ] First‑time PWA user sees notification permission prompt after first hand.
- [ ] After allow, backend receives subscription; subsequent reminders trigger Web Push.
- [ ] Cookie consent banner appears on first visit; analytics events only fire after consent.
- [ ] Settings page shows current notification status and toggle.

## Blocked by

#006 (frontend settings page), #021 (backend subscription endpoint)
