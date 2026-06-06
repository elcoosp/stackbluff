---
title: Core game engine – hand evaluator and deck/shuffle
labels: backend, game-engine, afk
blocked_by: 001
---

## What to build

Implement the `game_engine` module (owned by Agent 1) containing:

- `Deck` – generates a 52‑card list, shuffles using `rand::rngs::OsRng` (CSPRNG).
- `HandRank` enum (HighCard to StraightFlush) and `evaluate_hand(hole: &[Card;2], community: &[Card;5]) -> HandRank`.
- `compare_hands` function that compares two 7‑card hands and returns a winner or tie.

The module must be deterministic, panic‑free, and fast enough for 10k evaluations/sec.

## Acceptance criteria

- [ ] 100% branch coverage on hand evaluator (all hand ranks, ace‑low straight, kicker logic, tie detection).
- [ ] Chi‑square test on 1,000,000 shuffles shows uniform distribution (p > 0.05).
- [ ] No two shuffles produce the same sequence in 1M trials.
- [ ] Unit test that verifies the “wheel straight flush” (A♥ 2♥ 3♥ 4♥ 5♥) is correctly ranked above a king‑high flush.

## Blocked by

#001 (needs shared Card type in contracts)
