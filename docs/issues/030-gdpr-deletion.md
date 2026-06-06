---
title: GDPR data deletion – endpoint, background job, and frontend UI
labels: backend, frontend, compliance, afk
blocked_by: 002, 006
---

## What to build

Implement GDPR right to erasure (REQ-NFR-COMP-002):

- `DELETE /users/me` endpoint (authenticated) that enqueues a deletion request.
- Background job processes deletion within 30 days (immediate in MVP, but design for async).
- Deletion actions: anonymise hand history (set `user_id` to NULL), delete PII from `users` (keep only anonymised record for leaderboard history), delete sessions, subscription events, etc.
- Frontend: Settings page with “Delete my account” button, confirmation modal, and email confirmation for PWA users.
- Also implement `GET /users/me/data` (data portability) – returns JSON of all user data.

## Acceptance criteria

- [ ] User clicks delete → account flagged → after 30 days (or immediate during MVP) data is anonymised.
- [ ] Leaderboard no longer shows deleted user’s name, but historical chip wins remain aggregated.
- [ ] Re‑registration with same Telegram ID creates new, clean account.
- [ ] GDPR compliance check: no PII left in hot tables after deletion.

## Blocked by

#002 (users, hand_history tables exist), #006 (frontend settings page scaffold)
