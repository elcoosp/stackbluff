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
  - Club Pro (4.99 €/month) – only visible if user owns a club (check via store).
- Each item shows price in Telegram Stars (Mini App) or EUR (PWA).
- On purchase, call `POST /payments/create-intent` (backend), then redirect to Stars checkout (Mini App) or Stripe Checkout (PWA).
- After successful payment, frontend refreshes user balance or pass status via WebSocket push (`user.updated` message) or polling.

## Acceptance criteria

- [ ] Mini App: clicking chip bundle opens Telegram Stars invoice; after payment, chips appear in balance.
- [ ] PWA: Stripe Checkout loads, returns to success page, chips credited.
- [ ] Active Season Pass shows countdown timer and “Unlimited Oracle” badge in Oracle UI.
- [ ] Club Pro purchase unlocks customisation UI (even if customisation not yet implemented – placeholder).

## Blocked by

#006 (frontend scaffold), #017 (payment backend)
