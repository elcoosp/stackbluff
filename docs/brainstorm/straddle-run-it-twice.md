Here is a comprehensive technical specification document for implementing Straddle and Run It Twice (RIT) based on your existing Rust/React architecture. 

---

# Feature Specification: Straddle & Run It Twice (RIT)

## 1. Overview
This document outlines the architecture and implementation steps required to add **Straddle** and **Run It Twice (RIT)** as optional, table-configurable features in StackBluff. 

These features are categorized as "Cash Game Conventions" — they do not alter the core hand rankings or dealing rules of Texas Hold'em, but modify betting structures and variance management.

*   **Straddle:** An optional blind bet by the Under-the-Gun (UTG) player before cards are dealt, effectively creating a third blind and granting the straddler the last preflop action.
*   **Run It Twice (RIT):** When two or more players are all-in and betting is closed, the remaining community cards are dealt multiple times. The pot is split into equal parts, one for each board runout.

---

## 2. Database & Configuration Changes

Both features must be toggleable at the table level. Table creators will specify if these features are allowed.

### `sb-shared-types/src/game_types.rs`
Update the `TableConfig` struct to include the new flags:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableConfig {
    pub max_players: u8,
    pub stake_level: StakeLevel,
    pub variant: GameVariant,
    pub min_buy_in: ChipAmount,
    pub max_buy_in: ChipAmount,
    pub turn_time_limit_ms: u64,
    // NEW FIELDS
    pub allow_straddle: bool,
    pub allow_run_it_twice: bool,
}
```

### `sb-db-entities/src/table.rs`
Update the `TableConfig` JSON struct stored in the database to include these flags so they persist across server restarts.
```rust
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct TableConfig {
    pub stake_level: String,
    pub min_players: u8,
    pub max_players: u8,
    pub is_tournament: bool,
    pub tournament_config: Option<TournamentConfig>,
    #[serde(default = "default_turn_time_ms")]
    pub turn_time_limit_ms: u64,
    // NEW FIELDS
    pub allow_straddle: bool,
    pub allow_run_it_twice: bool,
}
```

---

## 3. Backend Implementation: Game Engine (`sb-game-engine`)

The core poker engine requires modifications to handle the altered preflop action order (Straddle) and multiple board evaluations (RIT).

### 3.1. Straddle Logic
In `sb-game-engine/src/game_state.rs`, the `new_hand` function must accept an optional straddle amount.

1.  **Function Signature Update:**
    ```rust
    pub fn new_hand(
        table_id: TableId,
        players: Vec<(PlayerId, ChipAmount)>,
        dealer_index: usize,
        blinds: (ChipAmount, ChipAmount),
        straddle: Option<ChipAmount>, // NEW
    ) -> Result<Self, &'static str>
    ```
2.  **Blind Posting:** If `straddle` is `Some(amount)`, deduct this amount from the UTG player (player at `big_blind_index + 1`) and add it to the pot and their `total_bet`.
3.  **Min Raise:** The minimum raise preflop must now be at least the size of the straddle (if posted).
4.  **Action Order:** The first to act preflop shifts from UTG to the player immediately after the straddler. The straddler acts last preflop (just before the flop is dealt).

### 3.2. Run It Twice (RIT) Logic
RIT significantly impacts how the engine handles the end of a hand.

1.  **Multiple Boards:** The `GameState` struct currently holds `community_cards: Vec<Card>`. For RIT, you need to support multiple runouts. 
    ```rust
    pub struct GameState {
        // ... existing fields ...
        pub run_it_twice: bool,
        pub boards: Vec<Vec<Card>>, // Replaces community_cards if RIT is active
    }
    ```
2.  **Dealing Logic:** When the hand reaches a state where all active players are all-in (or only one active player remains facing no further action) and `run_it_twice` is true:
    *   Split the pending pot into two equal halves (handle odd chips by giving the extra to the first board).
    *   Deal the remaining streets (Turn/River) for Board 1.
    *   Deal the remaining streets (Turn/River) for Board 2 using the remaining deck.
3.  **Winner Evaluation:** The `calculate_pot_winners` function must evaluate each board separately against the players' hole cards and allocate half the pot to the winner of each board.

---

## 4. Backend Implementation: Actor & WebSocket Layer (`sb-table-registry`)

The Table Actor manages the state and communicates with the frontend. It must orchestrate the new features based on player choices.

### 4.1. Straddle Flow
1.  **Opt-in:** When a player is in the UTG position and `config.allow_straddle` is true, the frontend sends a WS message: `{ "type": "player_action", "action": "straddle" }` *before* the hand starts (or the actor checks a persistent `wants_to_straddle` flag for that seat).
2.  **Hand Start:** In `sb-table-registry/src/actor.rs`, the `start_new_hand` function checks if UTG wants to straddle. If so, it passes `Some(bb * 2)` to `GameState::new_hand`.

### 4.2. Run It Twice Flow
1.  **Prompting:** When an all-in occurs and betting closes, if `config.allow_run_it_twice` is true, the actor broadcasts a new WS message `RunItTwicePrompt` to the involved players.
2.  **Response:** Players respond via WS: `{ "type": "player_action", "action": "accept_rit" }` or `"decline_rit"`.
3.  **Execution:** If all involved players accept, the actor updates the `GameState` to enable RIT. The showdown reveal broadcast must then send both boards to the frontend.

### 4.3. New WS Message Types (`sb-table-registry/src/game_room.rs`)
```rust
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum RoomMessage {
    // ... existing variants ...
    #[serde(rename = "RunItTwicePrompt")]
    RunItTwicePrompt {
        involved_players: Vec<UserId>,
    },
    #[serde(rename = "ShowdownReveal")]
    ShowdownReveal(ShowdownReveal), // Updated to support multiple boards
}

// Update ShowdownReveal to hold an array of boards and pot splits
#[derive(Debug, Clone, Serialize)]
pub struct ShowdownReveal {
    pub players: Vec<ShowdownPlayer>,
    pub boards: Vec<Vec<WsCard>>, // Changed from community_cards
    pub pots: Vec<u64>,           // Pot per board
}
```

---

## 5. Frontend Implementation (React/TypeScript)

The UI must gracefully handle the new states, prompting users for Straddle/RIT and visually rendering multiple boards.

### 5.1. Table Creation UI (`CreateTableModal.tsx`)
Add checkboxes to the table creation form:
```tsx
<div className="flex items-center gap-4 mt-4">
  <label className="flex items-center gap-2 text-on-surface-variant">
    <input type="checkbox" checked={allowStraddle} onChange={(e) => setAllowStraddle(e.target.checked)} />
    Allow Straddle
  </label>
  <label className="flex items-center gap-2 text-on-surface-variant">
    <input type="checkbox" checked={allowRIT} onChange={(e) => setAllowRIT(e.target.checked)} />
    Allow Run It Twice
  </label>
</div>
```

### 5.2. Straddle Toggle UI (`ActionBar.tsx` or `TablePage.tsx`)
*   When it is the player's turn to act *before* a hand starts (they are UTG), and the table allows straddling, show a distinct "Straddle" button next to the PreAction panel.
*   Clicking it sets a local state `wantsToStraddle` and sends a WS message. If they change their mind before the hand starts, they can un-toggle it.

### 5.3. Run It Twice Prompt UI
*   Create a new modal/dialog component: `RunItTwiceDialog`.
*   When the `RunItTwicePrompt` WS message is received, open this dialog: *"You are All-In. Do you want to Run It Twice to reduce variance?"* with [Accept] and [Decline] buttons.
*   Once all players respond, the dialog closes.

### 5.4. Rendering Multiple Boards (`CommunityCards.tsx`)
This is the most visually significant change. 
1.  Update the `gameStore` to hold `communityCards: Card[][]` (an array of boards) instead of a flat array.
2.  In the `CommunityCards` component, if `boards.length > 1`, map over them and render two separate sets of 5-card slots, stacked vertically with a gap between them (e.g., "Run 1" and "Run 2" labels).
3.  At showdown, highlight the winning cards for *each* board separately. The `PlayerSpot` component must be updated to show two winning hand descriptions (e.g., "Run 1: Flush, Run 2: Pair").

### 5.5. WebSocket Hook Updates (`useGameWebSocket.ts`)
Update the message parser to handle the new payload shapes:
```typescript
case 'ShowdownReveal': {
  const players = (data.players || []).map((p: any) => ({ /* ... */ }));
  // Handle multiple boards
  const boards = (data.boards || []).map((board: any) => 
    board.map(convertCard)
  );
  return {
    type: 'ShowdownReveal',
    players,
    boards, // Updated field
    pots: data.pots || [],
  };
}
```

---

## 6. Edge Cases & Constraints

1.  **Straddle in Heads-Up:** In heads-up play, the dealer is the Small Blind. The non-dealer is the Big Blind. Straddling is typically not allowed in heads-up cash games. The backend should disable straddle if `players.len() == 2`.
2.  **RIT Pot Splits:** If the pot is an odd number (e.g., 1050 chips), the extra chip must be awarded to the winner of the *first* board runout. The engine must ensure deterministic odd-chip distribution.
3.  **RIT All-in Timing:** RIT is only offered when *no further betting action is possible*. This means either only one player remains, or all remaining players are all-in. It cannot be offered if players still have chips to bet.
4.  **Straddle Sizing:** A standard straddle is 2x the Big Blind. The spec assumes this fixed sizing. (Mississippi straddles from the button are a more complex variant and are excluded from this initial spec for simplicity).
