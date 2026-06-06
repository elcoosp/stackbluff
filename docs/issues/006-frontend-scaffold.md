---
title: Frontend monorepo scaffolding and platform abstraction
labels: frontend, contracts, afk
blocked_by: 001
---

## What to build

Set up the pnpm monorepo (Agent 2) with:

- `apps/pwa` – React 19 + Vite 8 (Rolldown) PWA, service worker stub.
- `apps/mini-app` – same React app but with feature flag `VITE_TELEGRAM=true` and Telegram WebApp SDK script.
- `packages/shared` – shared components, stores, and the `PlatformAPI` abstraction defined in #001.
- `packages/shared/platform/telegram.ts` and `platform/pwa.ts` implement the `PlatformAPI` interface.
- Add `@biomejs/biome` 2.4.15 with a single `biome.json` (format, lint, CSS/HTML rules).

## Acceptance criteria

- [ ] `pnpm install` succeeds; `pnpm dev` runs both PWA and Mini App builds without errors.
- [ ] Mini App includes `<script src="https://telegram.org/js/telegram-web-app.js">` and calls `window.Telegram.WebApp.ready()`.
- [ ] PWA registers a service worker stub and shows “Add to Home Screen” prompt.
- [ ] `PlatformAPI.getUser()` returns a mock user in development; correct Telegram user in Mini App.

## Blocked by

#001 (contracts – PlatformAPI interface shape)
