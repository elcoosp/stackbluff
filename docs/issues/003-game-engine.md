---
title: Pure poker game engine – hand evaluation, deck, shuffle, state transitions
labels: backend, game-engine, afk
blocked_by: 001
---

## What to build

Implement `sb-game-engine` crate (no async, no IO, pure domain logic):

- `Deck` – generates 52 cards, shuffles using `rand::rngs::OsRng` (CSPRNG).
- `HandRank` enum (HighCard to StraightFlush) with `evaluate_hand(hole_cards: &[Card;2], community: &[Card;5]) -> HandRank`.
- `compare_hands` – compares two 7‑card hands, returns `Ordering`.
- `GameState` – models a poker hand: blinds, dealing, betting rounds, showdown.
- Functions: `new_hand(state, players) -> HandId`, `apply_action(state, action) -> Result<NewState, ActionError>`, `is_hand_complete(state) -> bool`, `calculate_pot_winners(state) -> Vec<Winner>`.

**Important:** This crate is stateless and deterministic. No timers, no persistence.

## Acceptance criteria

- [ ] 100% branch coverage on hand evaluator (all hand ranks, ace‑low straight, kickers, ties).
- [ ] Shuffle distribution passes chi‑square test (p > 0.05 over 1M shuffles).
- [ ] `apply_action` rejects illegal actions (raise below minimum, out of turn, etc.).
- [ ] No panics on valid inputs.
- [ ] Benchmark: 10k hand evaluations per second.

## Blocked by

#001 (shared types – Card, ChipAmount, ActionType)
