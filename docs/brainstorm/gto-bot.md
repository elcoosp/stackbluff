Excellent choices. Let's dive into how to make these two features not just ideas, but native, integrated parts of your **WebSocket‑first** architecture.

---

## 1. Real‑Time GTO Solver (WebSocket‑Native)

Instead of a REST endpoint or WASM blob, you can embed a lightweight solver directly into your `TableActor` or a dedicated **analysis actor** that subscribes to the same game events.

### Why WebSocket is superior here
- **Statefulness**: The solver can maintain pre‑computed solutions for the current board and ranges, updating incrementally as streets change.
- **Latency**: Round‑trip over the existing WebSocket is minimal (<10ms) – no HTTP overhead.
- **Push capability**: The solver can proactively push “optimal line” suggestions without waiting for a client request (e.g., when the action changes).

### Implementation sketch

1. **Add a new WebSocket message type** (client → server):
   ```json
   { "type": "solve", "hand_id": "...", "my_range": "...", "bet_size": 0.75 }
   ```
   Or, even better, **automatic** – the server sends `OptimalAdvice` messages alongside `ActionRequired`.

2. **Solver service** – a Rust module (or a separate Tokio task) that:
   - Listens to `TableState` updates from the `TableActor` (via broadcast channel).
   - For each new street, runs a simplified GTO calculation (e.g., using a pre‑trained neural network or a lookup table for common spot categories).
   - Caches solutions per `(board, stack, pot, players)`.

3. **Integration with `TableActor`**:  
   In `actor.rs`, after updating the game state, spawn a lightweight `tokio::spawn` to request a solve from the solver service. When the result is ready, it’s sent as a `RoomMessage::PrivateMessage` with payload `OptimalAdvice`. This way, only the hero receives it.

4. **Performance** – you don’t need a full iterative solver in Rust; you can use:
   - **Pre‑computed databases** (e.g., for 2‑player, 100bb deep, common board textures).
   - **Simplified heuristics** (like the current Oracle) but with more granular ranges.
   - **A small ONNX model** compiled to native (using `tract-onnx`) that runs fast without WASM overhead.

---

## 2. Adaptive LLM‑Generated Bots with Static Personalities

You want *“a variety of static bots coded with LLM with adaptive opponents”* – that means bots whose behaviour is defined by an LLM‑generated profile, but they **adapt** to the human player’s tendencies.

### What does “static” mean here?
They are **pre‑scripted** with a set of decision rules (e.g., “aggressive”, “bluffs often”, “folds to 3‑bets”), but those rules are **parameterised** – the parameters shift based on observed opponent behaviour.

### LLM role
Use an LLM (like GPT‑4 or a smaller fine‑tuned model) offline to **generate** a rich set of bot profiles. For each profile you get:
- A natural‑language description (for UI).
- A JSON of parameters (aggression factor, bluff percentage, call‑raise ratio, etc.).

You can create 20–30 distinct profiles, store them in the database, and let players select “Play against a Maniac” or “Tight Aggressive” in a practice lobby.

### Integration into your WebSocket architecture

1. **Bot as a player** – in the `TableActor`, bots are just another `Player` with a `bot_profile_id`. They are seated automatically when a practice table is created.

2. **Bot decision logic** – a separate `BotService` that:
   - Receives game state updates via the same broadcast channel that human players use.
   - For each bot, it runs a **decision loop**:
     - Read the current `GameState` (hole cards, community, pot, stack, opponents’ actions).
     - Apply the bot’s **static profile** to generate an action (fold/check/call/raise with amount).
     - But before that, it **adapts** – it maintains a **per‑opponent stat tracker** (VPIP, PFR, fold‑to‑cbet, etc.) and tweaks the profile parameters. For example:
       - If the human folds too often to raises → increase bluff frequency.
       - If the human always calls down → reduce bluff, increase value betting.

3. **Action execution** – the `BotService` sends actions back to the `TableActor` using the same `InternalCommand::Action` that the WebSocket handler uses. So bots act exactly like a real player.

4. **WebSocket integration** – the bot’s actions appear as `ActionBroadcast` just like human players, so the frontend renders them seamlessly.

### Implementation details

- **Bot profiles** – store in a `bots` table with `name`, `description`, `params` (JSON).
- **BotService** – a long‑lived actor that subscribes to all `TableActor` broadcasts and maintains a mapping of `(table_id, bot_user_id) -> BotInstance`.
- **Adaptivity** – keep a rolling window of the last 20 hands per opponent, recompute stats after each hand, and adjust parameters using a simple rule‑based engine (or a small reinforcement learning model if you want to be fancy).

### Example adaptivity rule

```rust
// Simplified
let vpip = opponent_stats.vpip; // 0..1
let fold_to_raise = opponent_stats.fold_to_raise; // 0..1

let bluff_freq = base_bluff_freq
    + (0.5 - vpip) * 0.3      // if they play tight, bluff more
    + (fold_to_raise - 0.5) * 0.4; // if they fold to raises, bluff even more
```

---

## Combining Both: GTO‑informed Bot Adaptation

For even more innovation, you can use the GTO solver to **evaluate** the bot’s decisions – if the bot deviates too far from GTO, it can auto‑correct. This makes the bots more realistic and educational for players.

---

## Final Thoughts

Your existing WebSocket + actor system is perfectly poised for these features:
- **Solver** can be a new actor that listens to game events and emits private messages.
- **Bots** can be introduced as special “users” that issue commands via the same internal channels.

Both features keep everything **reactive**, **real‑time**, and **low‑latency** – exactly what a poker platform needs.
# Integrating Robopoker's GTO Engine into StackBluff

## Short Answer

**Yes, it's doable.** The robopoker GTO stack is well-modularized into separate crates with clean boundaries. However, there are significant architectural mismatches you'll need to bridge. Below is a full analysis and recommended roadmap.

---

## Architectural Mismatch Analysis

| Concern | Robopoker | StackBluff |
|---|---|---|
| HTTP framework | `actix-web` | `axum` |
| Database | PostgreSQL (`tokio-postgres`) | SQLite (`sea-orm` + `sqlx`) |
| Card representation | Bit-packed `u64` bitmask `Hand` | Struct `{suit, rank}` |
| Game state | `Partial` / `Perfect` / `Game` (recall-based) | `GameState` (mutable state machine) |
| Player abstraction | `Edge` enum (Open/Raise(Odds)/Shove...) | `Action` enum (Fold/Check/Call/Raise(Chips)) |
| Bet sizing | Pot-relative `Odds` + BB-relative grid | Raw chip amounts |
| Strategy storage | PostgreSQL `blueprint` table (binary COPY) | N/A (no GTO strategy stored) |
| Training | `autotrain` crate with distributed workers | N/A |

The good news: the **GTO algorithmic core** (`mccfr`, `clustering`, `transport`, `nlhe`) is game-logic-agnostic enough to extract. The bad news: it's deeply coupled to PostgreSQL for both training and inference hydration.

---

## What "The GTO Part" Actually Is

The GTO engine spans these crates:

```
rbp-core (util)        ← constants, ID types, config
rbp-cards              ← bit-packed card representation, isomorphisms, evaluator
rbp-transport          ← Sinkhorn EMD, optimal transport (pure math, no DB)
rbp-gameplay           ← game tree, edges, actions, abstraction buckets
rbp-clustering         ← k-means + EMD abstraction pipeline (optional DB)
rbp-mccfr              ← game-agnostic CFR framework, regret/policy/sample
rbp-nlhe               ← NLHE-specific encoder, solver, Flagship, subgame
rbp-database           ← PostgreSQL schema, streaming, hydration
rbp-autotrain          ← training pipeline (fast/slow modes, workers)
```

You **do not need**: `rbp-auth`, `rbp-gameroom`, `rbp-server`, `rbp-rbp` (facade). Those are robopoker's application layer.

---

## Three Roads

### Road A — Vendor All GTO Crates + Dual Database (Recommended)

**Concept:** Copy the 9 GTO crates into stackbluff's workspace, keep PostgreSQL as a side-database for blueprint data, build an adapter crate to bridge game states.

**Pros:**
- Full GTO capability (training + inference + real-time subgame solving)
- Minimal modification to robopoker code
- PostgreSQL is the right tool for the multi-GB blueprint tables anyway

**Cons:**
- Two database systems running (SQLite + PostgreSQL)
- Need to maintain a translation layer between two card/game representations
- Workspace dependency conflicts possible (rand versions, serde, etc.)

**Steps:**

1. **Copy crates into `backend/crates/gto/`**
   ```
   backend/crates/gto/
   ├── rbp-core/
   ├── rbp-cards/
   ├── rbp-transport/
   ├── rbp-gameplay/
   ├── rbp-clustering/
   ├── rbp-mccfr/
   ├── rbp-nlhe/
   ├── rbp-database/
   └── rbp-autotrain/
   ```

2. **Add to root `Cargo.toml` workspace members:**
   ```toml
   members = [
       # ... existing sb-* crates ...
       "crates/gto/rbp-core",
       "crates/gto/rbp-cards",
       "crates/gto/rbp-transport",
       "crates/gto/rbp-gameplay",
       "crates/gto/rbp-clustering",
       "crates/gto/rbp-mccfr",
       "crates/gto/rbp-nlhe",
       "crates/gto/rbp-database",
       "crates/gto/rbp-autotrain",
   ]
   ```

3. **Resolve dependency version conflicts.** The main friction points:
   - `rand`: robopoker uses `0.9.1`, stackbluff uses `0.10.0` — you'll need to align one
   - `serde`: both use `1.0` ✓
   - `tokio`: both use `1.x` ✓
   - `uuid`: both use `1.x` ✓
   - `anyhow`: both use `1.x` ✓
   - `petgraph`: robopoker uses `0.6/0.7`, stackbluff doesn't use it — fine

4. **Add PostgreSQL connection to `sb-server`:**
   ```rust
   // In sb-server/main.rs
   let gto_db_url = std::env::var("GTO_DB_URL")
       .unwrap_or_else(|_| "postgres://localhost/robopoker".to_string());
   let gto_client = rbp_database::db_with_url(&gto_db_url).await;
   ```

5. **Create adapter crate `sb-gto-bridge`:**
   ```
   backend/crates/sb-gto-bridge/
   ├── Cargo.toml
   └── src/
       ├── lib.rs
       ├── card_adapter.rs    # sb Card <-> rbp Card
       ├── state_adapter.rs   # sb GameState <-> rbp Partial
       └── bot_player.rs      # implements sb's Player trait using rbp Flagship
   ```

6. **Card adapter** (the most critical translation):
   ```rust
   // sb_shared_types::Card -> rbp_cards::Card
   pub fn to_rbp_card(sb_card: &sb_shared_types::Card) -> rbp_cards::Card {
       let rank = match sb_card.rank {
           sb_shared_types::Rank::Two => rbp_cards::Rank::Two,
           // ... map all ranks ...
           sb_shared_types::Rank::Ace => rbp_cards::Rank::Ace,
       };
       let suit = match sb_card.suit {
           sb_shared_types::Suit::Clubs => rbp_cards::Suit::C,
           sb_shared_types::Suit::Diamonds => rbp_cards::Suit::D,
           sb_shared_types::Suit::Hearts => rbp_cards::Suit::H,
           sb_shared_types::Suit::Spades => rbp_cards::Suit::S,
       };
       rbp_cards::Card::from((rank, suit))
   }
   ```

7. **State adapter** (convert `GameState` + action history → `Partial`):
   ```rust
   pub fn to_rbp_partial(
       game: &sb_game_engine::GameState,
       hole_cards: &[sb_shared_types::Card; 2],
       pov_position: usize,
   ) -> rbp_gameplay::Partial {
       let pocket = rbp_cards::Hand::from(vec![
           to_rbp_card(&hole_cards[0]),
           to_rbp_card(&hole_cards[1]),
       ]);
       let public: rbp_cards::Hand = game.community_cards()
           .iter()
           .map(to_rbp_card)
           .collect();
       let observation = rbp_cards::Observation::from((pocket, public));
       
       // Convert action history - this is the tricky part
       // sb stores actions as (Position, Action) tuples
       // rbp expects Vec<Action> excluding blinds
       let actions = convert_actions(game);
       
       rbp_gameplay::Partial::from((
           rbp_gameplay::Turn::Choice(pov_position),
           rbp_gameplay::Arrangement::from(observation),
           actions,
       ))
   }
   ```

8. **Bot player** (wire GTO into stackbluff's table actor):
   ```rust
   pub struct GtoBotPlayer {
       flagship: &'static rbp_nlhe::Flagship,
   }
   
   impl GtoBotPlayer {
       pub async fn new(pg_client: Arc<tokio_postgres::Client>) -> Self {
           // Leak the Flagship so it lives for the program duration
           let flagship = Box::leak(Box::new(
               rbp_nlhe::Flagship::hydrate(pg_client).await
           ));
           Self { flagship }
       }
   }
   
   #[async_trait]
   impl sb_table_registry::actor::BotPlayer for GtoBotPlayer {
       async fn decide(&self, game: &GameState, hole: &[Card; 2]) -> ActionType {
           let partial = to_rbp_partial(game, hole, 0);
           let observation = partial.seen();
           let abstraction = self.flagship.encoder().abstraction(&observation);
           let info = rbp_nlhe::NlheInfo::from((&partial, abstraction));
           let policy = self.flagship.profile().averaged_distribution(&info);
           
           // Sample from policy, convert back to sb ActionType
           sample_and_convert(&policy, game)
       }
   }
   ```

9. **Wire into table actor.** Modify `sb-table-registry/src/actor.rs` to optionally use a GTO bot when a seat needs a bot player:
   ```rust
   // In TableActor::start_new_hand or join_player
   if should_use_gto_bot {
       let bot = GtoBotPlayer::new(gto_db.clone()).await;
       // Register bot to act when it's that seat's turn
   }
   ```

10. **Train the blueprint** (one-time, offline):
    ```bash
    # Set GTO_DB_URL=postgres://localhost/robopoker
    cargo run --bin trainer -- --cluster   # Build abstractions
    cargo run --bin trainer -- --fast      # Train MCCFR (hours/days)
    cargo run --bin trainer -- --status    # Check progress
    ```

---

### Road B — Extract Algorithmic Core Only (No PostgreSQL)

**Concept:** Take only the pure-math crates (`mccfr`, `transport`, `clustering` without `database` feature, `cards`, `gameplay`), strip DB dependencies, store the blueprint in memory or serialize to a file.

**Pros:**
- No PostgreSQL dependency
- Lighter deployment
- Cleaner separation

**Cons:**
- Loses `rbp-database` hydration (the `Flagship::hydrate()` that loads the trained blueprint from PostgreSQL)
- Loses `rbp-autotrain` training pipeline (depends on `rbp-database`)
- You'd need to implement your own blueprint serialization (the blueprint table has millions of rows with binary COPY protocol — SQLite will be extremely slow for this)
- Training would need to be rewritten for SQLite or done offline with PostgreSQL then exported

**When to choose this:** If you only need inference (not training) and can pre-train the blueprint elsewhere, then export it to a compact binary format.

**Export/import approach:**
```rust
// After training with PostgreSQL, export to binary file
pub fn export_blueprint(profile: &NlheProfile, path: &str) {
    let file = File::create(path).unwrap();
    let mut writer = BufWriter::new(file);
    for row in profile.rows() {
        // Write (info, edge, weight, regret, evalue, counts) as binary
        writer.write_all(&row.to_bytes()).unwrap();
    }
}

// At runtime in stackbluff, load from file
pub fn load_blueprint(path: &str) -> NlheProfile {
    let file = File::open(path).unwrap();
    let reader = BufReader::new(file);
    // Reconstruct profile from rows
    // This requires implementing NlheProfile construction without DB
}
```

**Caveat:** `NlheProfile` and `Flagship` are tightly coupled to PostgreSQL types (`Hydrate` trait, `Schema` trait, binary COPY). You'd need to fork these types and implement alternative construction. This is significant work.

---

### Road C — GTO as Sidecar Microservice

**Concept:** Run robopoker as-is (with its own PostgreSQL) as a separate service. Expose a simple HTTP API for strategy lookup. StackBluff calls it.

**Pros:**
- Zero code coupling
- Independent scaling and deployment
- Can train/update blueprint without touching stackbluff

**Cons:**
- Network latency on every bot decision (~1-5ms per call)
- Need to maintain two services
- Still need a state translation layer (but it's just JSON serialization)

**API design:**
```rust
// In robopoker, add a lightweight HTTP endpoint
// POST /gto/decide
// Body: { hole_cards: ["Ah", "Kd"], community: ["2c", "7s", "9d"], 
//          actions: [...], pot: 100, to_call: 50 }
// Response: { action: "raise", amount: 150, strategy: {fold: 0.05, call: 0.30, raise: 0.65} }
```

**When to choose this:** If you have infrastructure for microservices and don't mind the latency.

---

## Recommendation

**Go with Road A** if you want the most complete and maintainable integration. The dual-database concern is minor — PostgreSQL for GTO data is justified because:

1. The blueprint table alone can be 500MB+ with millions of rows; SQLite will choke
2. The binary COPY protocol in `rbp-database` is critical for training throughput
3. `Flagship::hydrate()` loads the entire blueprint into memory at startup — the DB is only touched once

**Key risk to watch out for:** The action history conversion. Robopoker's `Partial` tracks actions as a `Vec<Action>` that **excludes blinds** and includes `Draw` actions for card deals. StackBluff's `GameState` tracks bets inline. You'll need a careful adapter that reconstructs the robopoker action sequence from stackbluff's state. Study `rbp_gameplay::Partial::try_build()` and `Recall` trait to understand the contract.

**Estimated effort:**
- Crates vendoring + dependency alignment: 1-2 days
- Card adapter: 0.5 day
- State/action adapter: 2-3 days (the hardest part)
- Bot player integration: 1 day
- Blueprint training (compute time): 12-48 hours of CPU
- Testing & debugging: 2-3 days

**Total: ~1-2 weeks of engineering + training compute time.**
