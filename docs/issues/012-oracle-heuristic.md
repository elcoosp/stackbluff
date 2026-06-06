---
title: Oracle heuristic engine – 50 hand analysis templates
labels: backend, oracle, afk
blocked_by: 001, 003
---

## What to build

Implement the Oracle module (Agent 1) as a trait `OracleApi` with method `analyze_hand(hand_history) -> Analysis`. Use heuristic engine:

- 50 pre‑written templates covering pre‑flop raises, c‑bets, pot odds, river bluff catching, positional play, and compliments.
- Template selection based on hand parameters (position, stack sizes, pot odds, hand strength).
- Output plain text analysis.
- Free users limited to 3 analyses per session (counted in memory, not persisted initially).

## Acceptance criteria

- [ ] 50 templates in a `templates.json` file, each with selection rules and output text.
- [ ] Given a hand where hero folds a flush draw with 3:1 pot odds, Oracle returns “Pot odds were 3:1; your flush draw was 4:1 – correct fold.”
- [ ] Session counter resets after 8 hours inactivity.
- [ ] Integration test: Oracle response time < 200ms.

## Blocked by

#001 (contracts – OracleApi), #003 (hand evaluator for hand strength)
