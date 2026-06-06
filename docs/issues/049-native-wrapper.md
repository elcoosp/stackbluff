---
title: Native iOS/Android wrapper – Capacitor build
labels: frontend, mobile, afk
blocked_by: 006
---

## What to build

Package the PWA as native iOS/Android apps using Capacitor (Vision Month 6):

- Add `apps/native` directory with Capacitor config.
- Configure iOS (Xcode project) and Android (Android Studio) builds.
- Implement native push notifications (via Firebase Cloud Messaging / APNS) as fallback for PWA Web Push.
- In‑app purchases bridge for App Store / Google Play (instead of Stripe on mobile).
- Keep same WebSocket backend; only payment and notification layers change.
- CI/CD: GitHub Actions builds `.ipa` and `.apk` on tag.

## Acceptance criteria

- [ ] Capacitor build produces runnable iOS and Android apps.
- [ ] App Store / Play Store internal test builds install and run.
- [ ] Native push notifications work when app is closed.
- [ ] In‑app purchases complete and credit chips.

## Blocked by

#006 (frontend monorepo – PWA already works)
