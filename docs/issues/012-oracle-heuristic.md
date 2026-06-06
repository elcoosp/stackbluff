---
title: Oracle heuristic engine – 50 hand analysis templates
labels: backend, oracle, afk
blocked_by: 001, 003
---

## What to build

Implement `sb-oracle` crate implementing `OracleService` from `sb-contracts`:

- Maintains a library of ≥50 templates in a `templates.json` file (embedded at compile time).
- Templates cover: pre‑flop raise sizing, c‑bet decisions, pot odds calculation, river bluff catching, positional play, compliment messages.
- Template selection based on hand parameters (position, stack sizes, pot odds, hand strength via `sb-game-engine`).
- Output plain text analysis (English only for now; i18n in Wave 4).
- Free users limited to 3 analyses per session (counted in memory, keyed by `user_id`; resets after 8 hours inactivity).
- Exposes `POST /oracle/analyze` REST endpoint (or WebSocket `request.oracle`).

## Acceptance criteria

- [ ] 50 templates in `templates.json`, each with selection rules and output text.
- [ ] Given a hand where hero folds a flush draw with 3:1 pot odds, Oracle returns “Pot odds were 3:1; your flush draw was 4:1 – correct fold.”
- [ ] Session counter resets after 8 hours inactivity (integration test with mock time).
- [ ] Oracle response time < 200ms.

## Blocked by

#001 (contracts – OracleService trait), #003 (hand evaluator for hand strength)
