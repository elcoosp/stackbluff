---
title: Email sending – password reset and registration verification (PWA)
labels: backend, auth, afk
blocked_by: 004
---

## What to build

Add transactional email for PWA users using Resend API (or AWS SES) – Agent 1 extension to `sb-auth`:

- On registration, send verification email with a one‑time link to verify address (JWT token).
- On password reset request, send reset email with token.
- Store `email_verified_at` timestamp in `users` table.
- Use `lettre` or Resend’s HTTP API. Queue emails via a background task (tokio oneshot or channel) to avoid blocking the request.
- Rate limit: max 3 verification emails per email per hour.

## Acceptance criteria

- [ ] New PWA user receives verification email within 10 seconds; clicking link marks account verified.
- [ ] Unverified users cannot start paid transactions (chip bundles, Season Pass) – reject with `403 Forbidden`.
- [ ] Password reset flow: request → receive email → reset form → password updated.
- [ ] No emails sent for Telegram‑only users (platform = 'telegram').

## Blocked by

#004 (authentication module exists)
