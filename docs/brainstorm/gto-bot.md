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
