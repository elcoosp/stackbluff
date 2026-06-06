---
title: Payment two‑phase commit – Stripe and Telegram Stars
labels: backend, payments, afk
blocked_by: 001, 002, 004
---

## What to build

Implement payment module (Agent 3) behind `PaymentApi`:

- `POST /payments/create-intent` – returns client secret (Stripe) or Stars invoice link.
- Webhook endpoints: `/payments/stripe/webhook` and `/payments/stars/webhook` – validate signatures, apply idempotency keys.
- Two‑phase commit: on webhook success, confirm pending transaction and credit chips.
- Store `subscription_events` table (full history, never truncated) for Club Pro and Season Pass.

## Acceptance criteria

- [ ] Stripe test webhook: successful payment credits chips exactly once (idempotent).
- [ ] Telegram Stars webhook with valid HMAC credits chips.
- [ ] Pending transaction expires after 10 minutes; no chip credit.
- [ ] Subscription events table records every event (start, renewal, cancellation).

## Blocked by

#001 (contracts – PaymentApi), #002 (subscription_events table exists), #004 (auth to identify user)
