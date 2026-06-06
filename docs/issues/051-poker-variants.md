---
title: Additional poker variants – PLO, OFC, Short Deck
labels: backend, game-engine, afk
blocked_by: 003, 009
---

## What to build

Add three new game variants (Vision Months 3–5):

1. **Pot‑Limit Omaha (PLO):** Each player gets 4 hole cards, must use exactly 2 of them.
2. **Open Face Chinese (OFC):** 13‑card variant with progressive fantasyland.
3. **Short Deck (6+ Hold'em):** Deck without 2–5, flush beats full house.

Each variant:
- New game engine module extending the hand evaluator.
- New table type (`variant` enum).
- Client UI adjusts to display 4 hole cards (PLO) or 3 rows (OFC).
- Separate leaderboards per variant.

## Acceptance criteria

- [ ] PLO hand evaluator correctly ranks hands (must use 2 hole cards).
- [ ] OFC fantasyland scoring implemented and validated.
- [ ] Short Deck hand rankings (flush > full house) correct.
- [ ] Each variant has its own lobby and leaderboard.

## Blocked by

#003 (base hand evaluator), #009 (table actor infrastructure)
