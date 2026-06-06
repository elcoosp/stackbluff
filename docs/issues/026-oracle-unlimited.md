---
title: Oracle unlimited access for Season Pass holders
labels: backend, oracle, afk
blocked_by: 002, 012
---

## What to build

Enhance Oracle module to respect Season Pass (REQ-FUNC-064):

- Add `users.active_season_pass` column (nullable season_id, expiry timestamp).
- When `request.oracle` arrives, check if user has an active Season Pass.
- If yes, allow unlimited analyses per session. If no, enforce the 3‑per‑session cap from #012.
- Session cap stored in Redis or in‑memory cache (per user, resets after 8 hours inactivity).
- Expose `GET /oracle/remaining` to inform frontend of remaining free analyses.

## Acceptance criteria

- [ ] Season Pass holder can request Oracle 10+ times in one session without block.
- [ ] Non‑pass holder blocked after 3 analyses; shows “Upgrade to Season Pass for unlimited Oracle”.
- [ ] Pass expiry correctly resets cap on next session.
- [ ] Unit test: pass expiry edge cases.

## Blocked by

#002 (users table needs season_pass columns), #012 (Oracle engine exists)
