---
title: Native iOS/Android wrapper – Capacitor build
labels: frontend, mobile, afk
blocked_by: 006
---

## What to build

Package the PWA as native iOS/Android apps using Capacitor (Vision Month 6) – Agent 2:

- Add `frontend/apps/native` directory with Capacitor config.
- Configure iOS (Xcode project) and Android (Android Studio) builds.
- Implement native push notifications via Firebase Cloud Messaging (Android) and APNS (iOS) as fallback for Web Push.
- In‑app purchases bridge for App Store / Google Play (instead of Stripe on mobile). Use `capacitor-plugin-inapp-purchase`.
- Keep same WebSocket backend; only payment and notification layers adapt via `PlatformAPI` implementations for native.
- CI/CD: GitHub Actions builds `.ipa` and `.apk` on tag, optionally upload to TestFlight / Internal Track.

## Acceptance criteria

- [ ] Capacitor build produces runnable iOS and Android apps (simulator/emulator).
- [ ] App Store / Play Store internal test builds install and run.
- [ ] Native push notifications work when app is closed.
- [ ] In‑app purchases complete and credit chips (integration with #017).

## Blocked by

#006 (frontend monorepo – PWA already works)
