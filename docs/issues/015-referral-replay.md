---
title: Viral referral and replay card generation
labels: backend, viral, afk
blocked_by: 001, 002, 003
---

## What to build

Implement `sb-viral` crate (Agent 4) behind `ViralService` trait:

- On significant hand (straight flush+, all‑in, tournament KO), generate a replay card metadata (JSON description). Actual image rendering will be done by frontend or a separate service; for MVP, produce a shareable card data structure.
- Referral system: when a new user signs up via invite link (query param `ref=<user_id>`), store in `referrals` table `(referrer_id, referred_id, created_at)`.
- After referred user completes 5 hands, credit both users with chip bonus via `UserService::award_chips`.
- Bonus is double‑sided; for first 1000 users, triple bonus (configurable via env var).
- Expose `GET /referrals/stats` for frontend.

## Acceptance criteria

- [ ] Replay card generation triggers for qualifying hands; card contains result, winner name, invite link.
- [ ] Referral bonus credited within 5 seconds of 5th hand completion.
- [ ] First 1000 users get triple bonus; system correctly tracks global user count (use atomic counter).
- [ ] Unit test: hand qualifies → replay card metadata generated.

## Blocked by

#001 (contracts – ViralService, UserService), #002 (referrals table exists), #003 (hand evaluator to detect significant hands)
