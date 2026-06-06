---
title: Daily Hand Puzzle – shareable brainteaser
labels: backend, frontend, viral, afk
blocked_by: 003, 006
---

## What to build

Implement Daily Hand Puzzle (REQ-FUNC-054):

- **Backend** (Agent 4 extension to `sb-viral`):
  - Pre‑seed a set of 30+ puzzles in JSON (hole cards, community, action so far, correct action).
  - `GET /puzzle/today` returns puzzle for current date (UTC). Same puzzle for all users.
  - `POST /puzzle/submit` with user's chosen action. Evaluates correctness using hand evaluator (#003).
  - Store submission in `puzzle_submissions` table (user_id, date, correct).
  - After submission, return result (correct/incorrect) and correct answer explanation.

- **Frontend** (Agent 2):
  - Puzzle component on lobby or separate page.
  - After answer, show “Share my answer” button that calls `PlatformAPI.shareContent` with a card containing user's answer, correct answer, and invite link.

## Acceptance criteria

- [ ] Puzzle changes at 00:00 UTC daily.
- [ ] User can answer only once per day (checked by DB).
- [ ] Share card includes both chosen answer and correct answer, driving discussion.
- [ ] Metrics: puzzle completion rate tracked (store in DB).

## Blocked by

#003 (hand evaluator for correctness check), #006 (frontend share mechanism via PlatformAPI)
