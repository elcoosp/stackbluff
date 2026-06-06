---
title: Frontend monorepo – pnpm workspaces, PWA, Mini App, shared platform API
labels: frontend, contracts, afk
blocked_by: 001
---

## What to build

Set up `frontend/` as a pnpm monorepo (Agent 2):

- `apps/pwa` – Vite 8 (Rolldown) + React 19 + TypeScript 6. Service worker stub (`vite-plugin-pwa`).
- `apps/mini-app` – same React app but with feature flag `VITE_TELEGRAM=true`. Includes Telegram WebApp SDK script and `Telegram.WebApp.ready()`.
- `packages/shared` – shared components, Zustand stores, and the `PlatformAPI` abstraction.
- `packages/shared/platform/index.ts` defines `PlatformAPI` interface (getUser, sendPayment, shareContent, etc.).
- `packages/shared/platform/telegram.ts` and `pwa.ts` implement the interface.
- `biome.json` (Biome 2.4.15) – single config for linting, formatting, CSS/HTML checks.

## Acceptance criteria

- [ ] `pnpm install` succeeds; `pnpm dev` runs both PWA and Mini App without errors.
- [ ] Mini App calls `Telegram.WebApp.ready()` and `PlatformAPI.getUser()` returns Telegram user data.
- [ ] PWA registers a service worker and shows "Add to Home Screen" prompt.
- [ ] `biome check --apply` passes with zero errors.

## Blocked by

#001 (shared types – PlatformAPI interface)
