---
title: Viral referral and replay card generation
labels: backend, viral, afk
blocked_by: 001, 002, 003
---

## What to build

Implement viral mechanics (Agent 4) behind `ViralApi`:

- On significant hand (straight flush+, all‑in, tournament KO), generate a replay card (HTML/CSS canvas, later PNG via Puppeteer or similar). For now produce a shareable JSON description and a URL.
- Referral system: when a new user signs up via invite link, store `(referrer_id, referred_id)`.
- After referred user completes 5 hands, credit both users with chip bonus (double‑sided, triple for first 1000 users as per BR-015).
- Expose `POST /referrals/claim` for frontend to trigger bonus check.

## Acceptance criteria

- [ ] Replay card generation triggers for qualifying hands; card contains result, winner name, invite link.
- [ ] Referral bonus credited within 5 seconds of 5th hand completion.
- [ ] First 1000 users get triple bonus; system correctly tracks global user count.
- [ ] Unit test: hand qualifies → replay card metadata generated.

## Blocked by

#001 (contracts – ViralApi), #002 (referrals table exists), #003 (hand evaluator to detect significant hands)
