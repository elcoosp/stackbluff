---
title: Additional poker variants – PLO, OFC, Short Deck
labels: backend, game-engine, afk
blocked_by: 003, 009
---

## What to build

Add three new game variants (Vision Months 3–5) – Agent 1:

1. **Pot‑Limit Omaha (PLO):** Each player gets 4 hole cards, must use exactly 2 of them. Update hand evaluator: generate all combinations of 2 from 4, evaluate with 5 community.
2. **Open Face Chinese (OFC):** 13‑card variant with progressive fantasyland. Implement scoring rules and fantasyland qualification.
3. **Short Deck (6+ Hold'em):** Deck without 2–5, flush beats full house. Update hand ranking constants.

Implementation:
- Extend `GameVariant` enum in `sb-shared-types`.
- Each variant gets its own evaluation module in `sb-game-engine`.
- New table type: `TableConfig::Omaha`, `TableConfig::ShortDeck`, `TableConfig::OFC`.
- Frontend UI adjusts to display 4 hole cards (PLO) or 3 rows (OFC) – Agent 2.
- Separate leaderboards per variant (store `variant` column).

## Acceptance criteria

- [ ] PLO hand evaluator correctly ranks hands (must use 2 hole cards, 3 community). Unit test for all hand ranks.
- [ ] OFC fantasyland scoring implemented and validated with known test cases.
- [ ] Short Deck hand rankings (flush > full house) correct.
- [ ] Each variant has its own lobby and leaderboard (filterable).

## Blocked by

#003 (base hand evaluator), #009 (table actor infrastructure)
