---
title: Email sending – password reset and registration verification (PWA)
labels: backend, auth, afk
blocked_by: 004
---

## What to build

Add transactional email for PWA users using Resend API (or similar):

- On registration, send verification email with a one‑time link to verify address.
- On password reset request, send reset email with token.
- Store email verification status in `users.email_verified_at`.
- Use `lettre` or Resend’s HTTP API. Queue emails via background task to avoid blocking.

## Acceptance criteria

- [ ] New PWA user receives verification email within 10 seconds; clicking link marks account verified.
- [ ] Unverified users cannot start paid transactions (chip bundles, Season Pass).
- [ ] Password reset flow: request → receive email → reset form → password updated.
- [ ] No emails sent for Telegram‑only users.

## Blocked by

#004 (authentication module exists)
