---
title: GDPR data deletion – endpoint, background job, and frontend UI
labels: backend, frontend, compliance, afk
blocked_by: 002, 006
---

## What to build

Implement GDPR right to erasure (REQ-NFR-COMP-002):

- **Backend** (Agent 1):
  - `DELETE /users/me` endpoint (authenticated) that inserts a `deletion_request` record and returns `202 Accepted`.
  - Background job (daily) processes deletion requests: anonymises hand history (set `user_id` to NULL), deletes PII from `users` (keep only anonymised record for leaderboard history), deletes sessions, subscription events, etc.
  - Also implement `GET /users/me/data` (data portability) – returns JSON of all user data (hands, missions, referrals, payments).

- **Frontend** (Agent 2):
  - Settings page with “Delete my account” button, confirmation modal, and email confirmation for PWA users (if not verified, require email verification).
  - Show status of deletion request.

## Acceptance criteria

- [ ] User clicks delete → account flagged → after background job runs (within 30 days), data is anonymised.
- [ ] Leaderboard no longer shows deleted user’s name, but historical chip wins remain aggregated.
- [ ] Re‑registration with same Telegram ID creates new, clean account.
- [ ] GDPR compliance check: no PII left in hot tables after deletion (verified by test query).

## Blocked by

#002 (users, hand_history tables exist), #006 (frontend settings page scaffold)
