---
title: Daily Hand Puzzle – shareable brainteaser
labels: backend, frontend, viral, afk
blocked_by: 003, 006
---

## What to build

Implement Daily Hand Puzzle (REQ-FUNC-054):

- Backend serves one hand puzzle per day (from a pre‑seeded set of 30+ puzzles).
- `GET /puzzle/today` returns hand description (hole cards, community cards, action so far) and 4 possible actions (fold, call, raise, all‑in).
- User submits answer via `POST /puzzle/submit { action }`.
- Server evaluates correctness using hand evaluator + expected play (pre‑defined correct action).
- After submission, frontend shows result and a “Share my answer” button.
- Sharing generates a social card with user’s answer and correct answer, plus invite link.

## Acceptance criteria

- [ ] Puzzle changes at 00:00 UTC daily.
- [ ] User can answer only once per day.
- [ ] Share card includes both chosen answer and correct answer, driving discussion.
- [ ] Metrics: puzzle completion rate tracked for engagement.

## Blocked by

#003 (hand evaluator for correctness check), #006 (frontend share mechanism via PlatformAPI)
