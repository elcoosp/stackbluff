---
title: Frontend shop – chip bundles, Season Pass, Club Pro
labels: frontend, payments, ui, afk
blocked_by: 006, 017
---

## What to build

Implement shop UI for both PWA and Mini App (Agent 2):

- Shop page (`/shop`) displaying:
  - Chip bundles (e.g., 10k chips / 1 €, 50k / 4 €, 250k / 15 €, 1M / 40 €).
  - Season Pass (5.99 €, valid 8 weeks).
  - Club Pro (4.99 €/month) – only visible if user owns a club.
- Each item shows price in Telegram Stars (Mini App) or EUR (PWA).
- On purchase, calls `POST /payments/create-intent` (backend), then redirects to Stars checkout or Stripe Checkout.
- After successful payment (webhook), frontend refreshes user balance or pass status via WebSocket push or polling.

## Acceptance criteria

- [ ] Mini App: clicking chip bundle opens Telegram Stars invoice; after payment, chips appear in balance.
- [ ] PWA: Stripe Checkout loads, returns to success page, chips credited.
- [ ] Active Season Pass shows countdown timer and “Unlimited Oracle” badge.
- [ ] Club Pro purchase unlocks customisation UI (even if customisation not yet implemented – placeholder).

## Blocked by

#006 (frontend monorepo), #017 (payment backend)
