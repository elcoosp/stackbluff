## Additional poker variants – PLO, OFC, Short Deck

**Title:** Additional poker variants – PLO, OFC, Short Deck  
**Labels:** `backend, game-engine, afk`  
**Blocked by:** #003 (base hand evaluator), #009 (table actor infrastructure)

---

### 📌 Summary

Add three new poker variants to the game engine (Vision Months 3–5):

1. **Pot‑Limit Omaha (PLO)**: Players receive **4 hole cards** and must use **exactly 2** of them together with **3** of the 5 community cards. Hand evaluation requires generating all combinations of 2 hole cards from 4 and comparing with the best 5‑card hand from the community.
2. **Open Face Chinese (OFC)**: A 13‑card variant with progressive fantasyland. Players arrange 13 cards into 3 rows (top, middle, bottom) with specific hand strength rules. Fantasyland qualification is tracked (e.g., making a full house or better in the bottom row).
3. **Short Deck (6+ Hold'em)**: Deck contains only 36 cards (6 through Ace). **Flush beats a full house** (rank order change). Hand evaluation must reflect the adjusted hand ranks.

All variants are integrated into the existing game engine (`sb-game-engine`), with new `GameVariant` enums and separate evaluation modules. The frontend UI adjusts accordingly (e.g., showing 4 hole cards for PLO, 3 rows for OFC) but the primary implementation is backend‑centric. Separate leaderboards per variant are stored with a `variant` column.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Game variant enum | `backend/crates/sb-shared-types/src/game_types.rs` (GameVariant) |
| Hand evaluator | `backend/crates/sb-game-engine/src/evaluate.rs` (base evaluator) |
| Game state | `backend/crates/sb-game-engine/src/game_state.rs` (deal, betting, showdown) |
| Table config | `backend/crates/sb-shared-types/src/game_types.rs` (TableConfig – add variant field) |
| Table actor | `backend/crates/sb-table-registry/src/actor.rs` (spawn tables with variant) |
| Lobby API | `backend/crates/sb-rest-router/src/lobby_models.rs` (list tables with variant) |
| Leaderboard | `backend/crates/sb-db-entities/src/leaderboard_global_mv.rs` – add `variant` column. |
| Frontend (UI adjustments) | `frontend/apps/pwa/src/components/game/` – show 4 cards for PLO, 3 rows for OFC. |

---

### 🔧 What to build

#### 1. Extend `GameVariant` enum

Add new variants to `sb-shared-types/src/game_types.rs`:

```rust
pub enum GameVariant {
    Holdem,
    Omaha,
    OmahaHiLo,       // optional
    ShortDeck,
    Ofc,             // Open Face Chinese
}
```

#### 2. PLO hand evaluation (Pot‑Limit Omaha)

- Create a new module `sb-game-engine/src/evaluate_omaha.rs`.
- Implement a function `evaluate_omaha(hole_cards: &[Card; 4], community: &[Card; 5]) -> HandStrength`:
  - Generate all 2‑card combinations from the 4 hole cards (6 combinations).
  - For each pair, combine with the 5 community cards to form a 7‑card hand.
  - Evaluate using the existing 7‑card evaluator (from `evaluate.rs`).
  - Return the best hand strength across all combinations.
- Update the core `evaluate_hand_strength` to dispatch to the correct module based on `GameVariant`.

#### 3. Short Deck hand rankings

- Create `sb-game-engine/src/evaluate_shortdeck.rs`.
- Use the same evaluation logic as Hold'em but with:
  - A deck of 36 cards (remove 2–5).
  - Adjusted hand rankings: **Flush beats Full House** (i.e., Flush rank > Full House).
- Update the `HandRank` enum ordering (or override in the evaluation function) so that `HandRank::Flush` is ranked higher than `HandRank::FullHouse` when the variant is Short Deck.

#### 4. OFC (Open Face Chinese) – core logic

- Create `sb-game-engine/src/evaluate_ofc.rs`.
- Define a struct `OfcHand` with three rows:
  - `top: Vec<Card>` (3 cards)
  - `middle: Vec<Card>` (5 cards)
  - `bottom: Vec<Card>` (5 cards)
- Implement hand strength evaluation for each row (using standard 5‑card evaluation).
- Implement **scoring**:
  - Compare corresponding rows between players; each row win = 1 point.
  - Bonus points for:
    - Fantasyland qualification (e.g., full house or better in bottom row).
    - Royalties (e.g., straight flush in bottom = 10 points).
  - Fantasyland: if a player qualifies, they get to set the next hand with extra cards (progressive fantasyland).
- Implement a `OfcGameState` that manages the deal (5 cards at a time? Actually OFC is usually 5 cards dealt at the start, then one card at a time). For simplicity, we can implement a turn‑based version where players place cards one by one.
- The full OFC game loop is complex; for MVP, implement basic rules: 13 cards dealt, players arrange them, then scoring.

#### 5. Table actor integration

- In `TableActor`, when creating a new hand, check the `GameVariant` from `TableConfig`.
- If `Omaha`, deal 4 hole cards instead of 2.
- If `ShortDeck`, use the short deck (remove 2–5).
- If `OFC`, use a completely different game loop (no betting, just card placement).
- For OFC, we may need a separate actor or a flag to switch modes.

#### 6. Frontend UI adjustments (Agent 2)

- In `TablePage`, render 4 hole cards for PLO instead of 2.
- For OFC, render 3 rows (top, middle, bottom) with drag‑and‑drop or click placement.
- In the lobby, display the variant icon and filter tables by variant.

#### 7. Leaderboard per variant

- Add a `variant` column to `leaderboard_global_mv` and `user_statistics` (or a separate table).
- Modify the leaderboard query to filter by variant (or provide separate leaderboards).
- Update the frontend to show variant‑specific leaderboards (tabs or dropdown).

---

### ✅ Acceptance Criteria

- [ ] **PLO:**
  - [ ] Hand evaluator correctly ranks hands (must use exactly 2 hole cards).
  - [ ] Unit tests cover all hand ranks (high card, pair, trips, straight, flush, full house, quads, straight flush).
  - [ ] Table deals 4 hole cards; betting and showdown work as in Hold'em.
- [ ] **Short Deck:**
  - [ ] Deck contains only 36 cards (6–A).
  - [ ] Flush > Full House (verified with unit tests comparing both ranks).
  - [ ] Straight and flush probabilities match known Short Deck statistics.
- [ ] **OFC:**
  - [ ] Basic setup: 13 cards dealt; player arranges into 3 rows.
  - [ ] Scoring: row‑by‑row comparison, bonus points, fantasyland qualification.
  - [ ] Fantasyland progressive (if implemented) works correctly.
- [ ] **Lobby & Leaderboard:**
  - [ ] Tables are filterable by variant.
  - [ ] Leaderboards are per‑variant (global and club).
- [ ] **Frontend (Agent 2):**
  - [ ] PLO shows 4 hole cards.
  - [ ] OFC shows 3 rows for card placement.
  - [ ] UI clearly indicates the variant.

---

### 🔗 Blocked By

- **#003** – Base hand evaluator (for 5‑ and 7‑card hands) must exist.
- **#009** – Table actor infrastructure (deal, betting, showdown) must be functional to extend.

---

### 🧪 Testing Notes

- **Unit tests** for each evaluator:
  - PLO: test all hand ranks, ensure no illegal combinations.
  - Short Deck: test flush > full house.
  - OFC: test scoring with known configurations.
- **Integration tests** for table creation and hand playing for each variant.
- **Performance** for PLO: generating 6 combinations per player; should be < 1ms per hand.

---

### 📝 Implementation Hints

- **PLO**: Reuse the existing 7‑card evaluator; the only new logic is combination generation.
- **Short Deck**: Use the same evaluator but with a custom deck and a rank adjustment flag.
- **OFC**: This is the most complex. Consider implementing a separate `OfcActor` that doesn't use the standard `GameState` (since there's no betting). The actor could be a new type of table that manages the placement and scoring logic.
- **Frontend**: For OFC, you'll need a drag‑and‑drop interface; this can be built using `react-dnd` or `@dnd-kit/core`.
- **Leaderboard**: Add a `variant` column to the materialised view and refresh it regularly. For MVP, you can have separate tables or filter by variant in queries.
