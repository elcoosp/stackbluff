---
title: Oracle unlimited access for Season Pass holders
labels: backend, oracle, afk
blocked_by: 002, 012
---

## What to build

Enhance `sb-oracle` crate to respect Season Pass (REQ-FUNC-064):

- Add `users.active_season_pass` column (nullable season_id, expiry timestamp) via migration.
- When `request.oracle` arrives, check if user has an active Season Pass (query via `UserRepo`).
- If yes, allow unlimited analyses per session. If no, enforce the 3‑per‑session cap from #012.
- Session cap stored in `sb-oracle` cache (in‑memory `DashMap` with TTL, keyed by `(user_id, date)`).
- Expose `GET /oracle/remaining` to inform frontend of remaining free analyses.

## Acceptance criteria

- [ ] Season Pass holder can request Oracle 10+ times in one session without block.
- [ ] Non‑pass holder blocked after 3 analyses; error response includes `upgrade_url`.
- [ ] Pass expiry (timestamp) correctly resets cap after expiry.
- [ ] Unit test: pass expiry edge cases (e.g., expired pass returns to free tier).

## Blocked by

#002 (users table needs season_pass columns), #012 (Oracle engine exists)
