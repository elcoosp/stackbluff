## Speed Poker / Zoom mode – quick fold and fast table rotation

**Title:** Speed Poker / Zoom mode – quick fold and fast table rotation  
**Labels:** `backend, frontend, game-engine, afk`  
**Blocked by:** #009 (table actor loop), #018 (frontend table view)

---

### 📌 Summary

Implement **Speed Poker** (Zoom / fast‑fold) mode (SN-009 – Should Have, deferred to Wave 4). This mode allows players to play more hands per hour by pre‑selecting actions and automatically rotating to new tables after folding.

Key features:

- **New table type**: `SpeedPoker` (6 seats) with a configurable turn time limit (e.g., 15s instead of 30s).
- **Pre‑select action**: Players can set a default action (`fold`, `check/call`, or a specific raise amount) that executes instantly when it becomes their turn (no timer wait).
- **Fast rotation**: When a player folds or leaves, they are immediately placed into a waiting queue. Once enough players are queued (6), they are assigned to a new table (or fill an existing one).
- **Queue management**: The backend maintains a `SpeedQueue` per stake level, assigning players to tables as they become available.

The frontend UI for Speed Poker is similar to a normal table but includes a “Pre‑select action” toggle and shows queue position after folding. The game engine and table actor are extended to support pre‑actions and fast rotation.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Table config | `backend/crates/sb-shared-types/src/game_types.rs` (TableConfig) – add `TableMode::SpeedPoker` |
| Table actor | `backend/crates/sb-table-registry/src/actor.rs` (TableActor) – handle pre‑actions and queue management |
| Game engine | `backend/crates/sb-game-engine/src/game_state.rs` – support pre‑action execution |
| Registry | `backend/crates/sb-table-registry/src/registry.rs` – manage SpeedQueue and table assignment |
| REST / WebSocket | `backend/crates/sb-ws-handler/src/lib.rs` – add message types for pre‑action and queue updates |
| Frontend game UI | `frontend/apps/pwa/src/components/game/ActionBar.tsx` – add pre‑action toggle |
| Frontend table page | `frontend/apps/pwa/src/pages/TablePage.tsx` – display queue position |

---

### 🔧 What to build

#### 1. Backend – new table mode and configuration

- Add `TableMode::SpeedPoker` to `TableConfig` (in `sb-shared-types`).
- Speed tables have:
  - Max 6 players.
  - Reduced turn timer (e.g., 15s, configurable).
  - No waiting for action if pre‑action is set.

#### 2. Backend – pre‑action support

- Add a new field to the `TableActor` state: `pre_actions: HashMap<UserId, PreAction>`, where `PreAction` is an enum:
  ```rust
  enum PreAction {
      Fold,
      CheckCall,
      Raise(ChipAmount),
  }
  ```
- When a player’s turn arrives, the actor checks if a pre‑action is set. If so, it executes that action **immediately** (without starting the timer) and proceeds to the next player. If no pre‑action, the timer starts as usual.
- Add WebSocket messages:
  - `set_pre_action` – client sends `{ type: 'set_pre_action', action: 'fold' | 'check_call' | 'raise', amount?: number }`.
  - `clear_pre_action` – removes the pre‑action.
- The client can also set/clear pre‑action via the `ActionBar` (see frontend).

#### 3. Backend – queue management (SpeedQueue)

- In `Registry`, maintain a `SpeedQueue` per `StakeLevel`:
  ```rust
  struct SpeedQueue {
      waiting: Vec<UserId>,
      active_tables: Vec<TableId>,
  }
  ```
- When a player joins a Speed table and later folds or leaves, they are **not** removed from the table immediately (they stay until the hand ends). After the hand, they are moved to the waiting queue (if they didn't bust out).
- The `Registry` periodically checks if there are at least 6 players in the queue. If so, it creates a new Speed table and assigns them (or fills an existing table that has empty seats).
- Players in the queue are notified of their position (via WebSocket) and receive a “Table ready” message when assigned.

#### 4. Backend – table assignment and rotation

- When a player is assigned to a new table, the frontend receives a `RoomAssigned` message with the new `room_id`. The client automatically joins that table.
- The player’s stack remains the same (chips carry over) – they can buy in for the same amount or change it (subject to table limits).

#### 5. Frontend – Speed Poker UI

- On the lobby, add a “Speed Poker” filter or a separate tab (alongside Cash Games and Tournaments). Speed tables are listed with a lightning icon.
- When joining a Speed table, the `TablePage` shows an additional control: **“Pre‑select action”** – a toggle or dropdown:
  - Options: `None`, `Fold`, `Check/Call`, `Raise X` (with an amount input).
- When a pre‑action is set, the `ActionBar` displays a small indicator (e.g., “Auto‑fold” or “Pre‑selected: Call”).
- If the player folds or leaves (and the table still has other players), they are placed in the queue. The `TablePage` shows a queue position indicator (e.g., “Waiting for table… Position 3/6”).
- When a new table is assigned, the frontend automatically transitions to the new table without requiring user action.

#### 6. Frontend – queue state display

- Add a persistent overlay (or a section in the sidebar) showing the player’s queue position and estimated wait time.
- Use the WebSocket to receive `queue_update` messages containing `{ position, total_waiting }`.

#### 7. Performance and benchmarking

- The backend should handle 3× the hand volume of normal tables (expected ~60 hands/hour per table vs ~20 for normal).
- Optimise the table actor loop to minimise latency; use `tokio` spawns and avoid blocking operations.

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] A new table type `SpeedPoker` is available with 6 seats and a shorter turn timer.
  - [ ] Players can set a pre‑action (`fold`, `check/call`, `raise`) via WebSocket.
  - [ ] If a pre‑action is set, it executes instantly when the player’s turn arrives (no timer delay).
  - [ ] After a hand, folded players are moved to a queue per stake level.
  - [ ] The system automatically creates new Speed tables when 6 players are queued, and assigns them.
  - [ ] Queue position updates are sent to the client.
  - [ ] Speed Poker leaderboard contributions are identical to normal cash games.

- [ ] **Frontend:**
  - [ ] Speed tables appear in the lobby with a lightning icon or special badge.
  - [ ] On a Speed table, the `ActionBar` includes a “Pre‑select action” toggle/dropdown.
  - [ ] When a pre‑action is set, the action bar shows an indicator and the action executes automatically on the player’s turn.
  - [ ] After folding, the player sees their queue position and a “Next hand” countdown (estimated wait time).
  - [ ] When assigned to a new table, the view transitions smoothly to the new table (no manual action required).
  - [ ] The UI handles all states gracefully (loading, error, disconnected).

- [ ] **Performance:**
  - [ ] Speed tables handle at least 60 hands per hour (measured in a test environment with 6 players).
  - [ ] The queue assignment and table creation do not cause noticeable lag (< 500ms from queue full to table ready).

---

### 🔗 Blocked By

- **#009** – The table actor loop must be stable and support pre‑actions.
- **#018** – The frontend table view must be capable of showing the additional UI elements and handling queue transitions.

---

### 🧪 Testing Notes

- **Unit tests** for the queue management (`SpeedQueue` logic, assignment).
- **Integration tests**: Simulate 12 players joining Speed tables, folding, and being reassigned – verify no deadlocks and correct queue ordering.
- **Performance benchmarks**: Measure hand throughput under load (e.g., 100 players across multiple Speed tables).
- **Frontend tests**: Ensure the pre‑action toggle and queue display update correctly.

---

### 📝 Implementation Hints

- **Table lifecycle**: The `TableActor` should be refactored to support a “post‑hand” phase where players can be moved to the queue without tearing down the table. A `SpeedTable` actor can be a subclass or a flag.
- **Queue storage**: Use an in‑memory `DashMap` for the queue; persistence is not required since Speed Poker is a fast‑paced mode, and queue state can be re‑created on restart (players will simply re‑join).
- **Pre‑action execution**: In `TableActor::process_action`, if a pre‑action exists, call `apply_action` directly without scheduling a timer.
- **Frontend transitions**: Use `react-query` to manage the table assignment; when the WebSocket sends a new `RoomAssigned`, invalidate the current table query and navigate to the new table ID.

---

This ticket provides a complete specification for implementing Speed Poker / Zoom mode, with clear responsibilities for backend and frontend.
