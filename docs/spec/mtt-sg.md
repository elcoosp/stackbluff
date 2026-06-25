# Tournament System Architecture Specification (Final v3.0)

**Version:** 3.0  
**Date:** 2026-06-24  
**Status:** Production‑Ready – All Review Findings Addressed

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)  
2. [System Architecture](#2-system-architecture)  
3. [Phase 0: Foundation (Manual, Pre‑Agent)](#3-phase-0-foundation)  
   - 3.1 New Types & Contracts  
   - 3.2 Connection Broker with Room Subscriptions  
   - 3.3 TableActor Extensions (Unified TransferPlayerIn, Error‑aware ResumeHand)  
   - 3.4 Database Schema, Transaction Rules & Unit of Work  
   - 3.5 WebSocket Protocol Additions (With Concrete Types)  
   - 3.6 REST Router Stubs  
   - 3.7 GameState Extension (Starting Stack Tie‑Breaking)  
   - 3.8 Registry Modifications (create_tournament_table, reaper exclusion)  
   - 3.9 Logging & Observability Mandates (Structured)  
   - 3.10 BlindScheduler Public API (Contract)  
   - 3.11 Error Variants  
4. [Phase 1: Sit & Go (Agent 1)](#4-phase-1-sit--go)  
   - 4.1 SitGoTournament Actor  
   - 4.2 BlindScheduler Implementation  
   - 4.3 PayoutCalculator  
   - 4.4 TournamentServiceImpl  
   - 4.5 TournamentRepoImpl  
   - 4.6 REST & WS Handlers  
   - 4.7 Integration Test  
5. [Phase 2: MTT (Agent 2)](#5-phase-2-mtt)  
   - 5.1 MttDirector Actor  
   - 5.2 Rebalancer Algorithm (Exact, Using Unified TransferPlayerIn)  
   - 5.3 Final Table Merge  
   - 5.4 Blind Sync in MTT  
   - 5.5 Pause/Resume & Timeout Handling  
   - 5.6 Integration Test  
6. [Crash Recovery & Startup](#6-crash-recovery--startup)  
7. [Spectator Mode](#7-spectator-mode)  
8. [Testing Strategy](#8-testing-strategy)  
9. [Edge Cases, Rules & Guarantees](#9-edge-cases--rules)  
10. [Implementation Order & Agent Briefs](#10-implementation-order--agent-briefs)

---

## 1. Overview & Goals

Implement tournament support for **Sit & Go (S&G)** and **Multi‑Table Tournament (MTT)** formats in the existing Rust poker backend. The architecture must:

- Reuse `GameState`, `TableActor`, `Registry`, `UserRepo` without forking them.
- Use event‑driven orchestration via `HandCompletedEvent` broadcast.
- Keep tournament state and logic isolated in a new `sb-tournament` crate.
- Guarantee deterministic, testable behaviour for blinds, rebalancing, and payouts.
- Handle server crashes with a coherent refund / settlement strategy.
- Provide clear, well‑typed WebSocket messages and precise error variants.

Core principles: no hacks, clear contracts, exhaustive error handling, observability everywhere, and zero randomness in execution logic (only initial seat assignment is random).

---

## 2. System Architecture

```
sb-server (wires TournamentService into Router & WS)
  |
  v
sb-tournament (NEW)
  ├── TournamentServiceImpl (implements TournamentService)
  ├── TournamentRepoImpl (implements TournamentRepo)
  ├── SitGoTournament actor
  └── MttDirector actor
        | uses
        v
sb-table-registry (EXTENDED)
  ├── TableActor (now has TableMode, SetBlinds, Pause/Resume, Transfer…)
  ├── ConnectionBroker (global user+room message routing)
  ├── Registry (create_tournament_table, remove_room, reaper ignores tournament)
  └── HandCompletedEvent (includes busted_players with starting stacks)
        | uses
        v
sb-game-engine (EXTENDED only with get_busted_players(starting_stacks))
```

All tournament actors subscribe to the `Registry`’s broadcast of `HandCompletedEvent` and own direct `mpsc::Sender<InternalCommand>` handles to their child `TableActor`s. No separate `elimination_sink` – eliminations ride the existing event stream.

---

## 3. Phase 0: Foundation

These deliverables must be implemented and merged before either agent starts. They provide the contracts, infrastructure, and behaviour changes both agents depend on.

### 3.1 New Types & Contracts

**`sb-shared-types/src/ids.rs`** – add:
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TournamentId(pub Uuid);
```

**`sb-contracts/src/tournament_api.rs`** – fresh file with exactly the following traits. Notice **no** `on_player_eliminated` – that logic lives inside the tournament actors.

```rust
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sb_shared_types::{AppError, ChipAmount, RequestContext, TournamentId, UserId};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TournamentType { SitAndGo, Mtt }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TournamentStatus { Registering, Running, Completed, Cancelled }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlindLevel {
    pub level: u32,
    pub small_blind: i64,
    pub big_blind: i64,
    pub ante: i64,
    pub duration_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlindSchedule { pub levels: Vec<BlindLevel> }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutEntry { pub position: u32, pub percentage: f32 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutStructure { pub entries: Vec<PayoutEntry> }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TournamentConfig {
    pub tournament_type: TournamentType,
    pub max_players: u32,
    pub buy_in: ChipAmount,
    pub blind_schedule: BlindSchedule,
    pub payout_structure: PayoutStructure,
    pub start_delay_seconds: u32,        // S&G: 5s after full
    pub min_players_to_start: u32,       // MTT: configurable
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TournamentSummary {
    pub id: TournamentId,
    pub tournament_type: TournamentType,
    pub status: TournamentStatus,
    pub registered: u32,
    pub max_players: u32,
    pub buy_in: ChipAmount,
    pub prize_pool: ChipAmount,
    pub current_blind_level: Option<u32>,
    pub started_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TournamentResult {
    pub tournament_id: TournamentId,
    pub user_id: UserId,
    pub position: u32,
    pub prize: ChipAmount,
    pub completed_at: DateTime<Utc>,
}

#[async_trait]
pub trait TournamentService: Send + Sync {
    async fn create_tournament(
        &self, ctx: &RequestContext, config: TournamentConfig,
    ) -> Result<TournamentId, AppError>;

    async fn register(
        &self, ctx: &RequestContext, tournament_id: TournamentId, user_id: UserId,
    ) -> Result<(), AppError>;

    async fn unregister(
        &self, ctx: &RequestContext, tournament_id: TournamentId, user_id: UserId,
    ) -> Result<(), AppError>;

    async fn get_tournament(
        &self, ctx: &RequestContext, tournament_id: TournamentId,
    ) -> Result<TournamentSummary, AppError>;

    async fn list_tournaments(
        &self, ctx: &RequestContext, type_filter: Option<TournamentType>,
    ) -> Result<Vec<TournamentSummary>, AppError>;

    async fn get_results(
        &self, ctx: &RequestContext, tournament_id: TournamentId,
    ) -> Result<Vec<TournamentResult>, AppError>;
}

#[async_trait]
pub trait TournamentRepo: Send + Sync {
    /// Begin a tournament registration transaction.
    /// The implementation receives a shared database connection and must
    /// execute all steps within a single ACID transaction.
    async fn register_player_txn(
        &self,
        conn: &sea_orm::DatabaseConnection,
        tournament_id: TournamentId,
        user_id: UserId,
        buy_in: ChipAmount,
    ) -> Result<(), AppError>;

    /// Unregister player within a transaction (refund).
    async fn unregister_player_txn(
        &self,
        conn: &sea_orm::DatabaseConnection,
        tournament_id: TournamentId,
        user_id: UserId,
        buy_in: ChipAmount,
    ) -> Result<(), AppError>;

    async fn insert_tournament(&self, config: &TournamentConfig) -> Result<TournamentId, AppError>;
    async fn get_tournament(&self, id: TournamentId) -> Result<Option<TournamentRecord>, AppError>;
    async fn list_tournaments(&self, type_filter: Option<TournamentType>) -> Result<Vec<TournamentRecord>, AppError>;
    async fn set_status(&self, id: TournamentId, status: TournamentStatus,
                        started_at: Option<DateTime<Utc>>) -> Result<(), AppError>;
    async fn list_registrations(&self, id: TournamentId) -> Result<Vec<TournamentRegistration>, AppError>;
    async fn record_result(&self, r: &TournamentResult) -> Result<(), AppError>;
    async fn list_results(&self, id: TournamentId) -> Result<Vec<TournamentResult>, AppError>;
    async fn increment_prize_pool(&self, conn: &sea_orm::DatabaseConnection, id: TournamentId, amount: ChipAmount) -> Result<(), AppError>;
    async fn decrement_prize_pool(&self, conn: &sea_orm::DatabaseConnection, id: TournamentId, amount: ChipAmount) -> Result<(), AppError>;
}
```

*Transaction handling*: The `TournamentService` implementation will obtain a `sea_orm::DatabaseConnection` from the application state. For registration/unregistration it will call `repo.register_player_txn(conn, ...)` and within that method, the repo will use the provided connection to execute the deduct‑prize‑pool‑insert sequence. The `UserRepo` will also need a method that accepts a connection (like `update_chip_balance_with_conn`) to keep everything within the same transaction. These connection‑passing methods must be added to the existing repos (or wrapped). The spec requires this; if impractical, the fallback is to document that operations are not fully atomic in MVP, but the design intent is full atomicity.

### 3.2 Connection Broker with Room Subscriptions

**File:** `sb-table-registry/src/connection_broker.rs`

```rust
use std::sync::Arc;
use dashmap::DashMap;
use tokio::sync::mpsc;
use sb_shared_types::{UserId, TableId, RoomMessage};

pub struct ConnectionBroker {
    senders: Arc<DashMap<UserId, mpsc::UnboundedSender<RoomMessage>>>,
    room_subscribers: Arc<DashMap<TableId, Vec<UserId>>>,
}

impl ConnectionBroker {
    pub fn new() -> Self { ... }
    pub fn register_user(&self, user_id: UserId, tx: mpsc::UnboundedSender<RoomMessage>) { ... }
    pub fn unregister_user(&self, user_id: UserId) { ... }
    pub fn send_to_user(&self, user_id: UserId, msg: RoomMessage) { ... }
    pub fn subscribe_to_room(&self, room_id: TableId, user_id: UserId) { ... }
    pub fn unsubscribe_from_room(&self, room_id: TableId, user_id: UserId) { ... }
    pub fn broadcast_to_room(&self, room_id: TableId, msg: RoomMessage) {
        if let Some(subscribers) = self.room_subscribers.get(&room_id) {
            for uid in subscribers.value() {
                self.send_to_user(*uid, msg.clone());
            }
        }
    }
}
```

**Usage:**
- WS handler calls `register_user` on connection, `unregister_user` on disconnect.
- Tournament registration: the tournament actor calls `subscribe_to_room` for tournament‑wide messages (using the tournament ID as room ID) and later for table‑specific subscriptions.
- `TableActor` uses `broadcast_to_room` for all public state; it never sends directly to a user.

### 3.3 TableActor Extensions

**File:** `sb-table-registry/src/actor.rs`

Add to `TableActor` struct:
```rust
mode: TableMode,
broker: Arc<ConnectionBroker>,
current_blinds: Option<(ChipAmount, ChipAmount)>,
paused: bool,
timeout_handle: Option<tokio::task::JoinHandle<()>>,
// Remove user_senders entirely
```

**`TableMode` enum:**
```rust
pub enum TableMode {
    Cash,
    Tournament {
        parent: TournamentId,
        no_rebuy: bool,
    },
}
```

**New `InternalCommand` variants** (add to existing enum):
```rust
EnterTournamentMode {
    parent: TournamentId,
    broker: Arc<ConnectionBroker>,
},
SetBlinds {
    small: ChipAmount,
    big: ChipAmount,
},
PauseHand {
    respond_to: oneshot::Sender<()>,  // acknowledge pause
},
ResumeHand {
    force_dealer_seat: Option<u8>,
    respond_to: oneshot::Sender<Result<(), AppError>>,
},
TransferPlayerIn {
    user_id: UserId,
    player_id: PlayerId,
    stack: ChipAmount,
    seat: Option<u8>,                       // if None, actor picks first free seat
    respond_to: oneshot::Sender<Result<u8, AppError>>, // returns assigned seat or error
},
TransferPlayerOut {
    user_id: UserId,
    respond_to: oneshot::Sender<TransferOutResult>,
},
```

**`TransferOutResult`:**
```rust
pub struct TransferOutResult {
    pub player_id: PlayerId,
    pub stack: ChipAmount,
}
```

**Behavioural changes (no `BlindProvider` trait, no `elimination_sink`):**

1. **Starting hand blinds**  
   In `start_new_hand`:
   ```rust
   let (sb, bb) = match &self.mode {
       TableMode::Cash => blinds_for_stake(self.config.stake_level),
       TableMode::Tournament { .. } => {
           self.current_blinds
               .unwrap_or_else(|| (ChipAmount::new(1).unwrap(), ChipAmount::new(2).unwrap()))
       }
   };
   ```

2. **Auto‑start suppressed**  
   In `join_player`, do not start hand when `mode` is `Tournament`. The tournament actor will send `ResumeHand` when appropriate.

3. **No rebuys**  
   `process_rebuy` returns `AppError::InvalidInput("no rebuys in tournament")` for tournament mode.

4. **Pause/Resume with timeout cancellation and validation**  
   - On `PauseHand`: set `paused = true`. If `timeout_handle` exists, abort it and set to `None`. Immediately send `()` via `respond_to`.
   - On `ResumeHand`:
     - If `force_dealer_seat` is `Some(seat)`:
       - Check that seat number is within 0..config.max_players and that a player occupies that seat and has stack > 0.
       - If valid, set `last_dealer_index` to the index of that seat.
       - If invalid, send `Err(AppError::InvalidInput("invalid dealer seat"))` via `respond_to` and return without resuming.
     - Set `paused = false`.
     - If a hand is in progress and waiting for an action, restart the timeout with the full turn duration.
     - Send `Ok(())` via `respond_to`.

5. **SetBlinds**  
   Store the new blinds in `self.current_blinds`. Do nothing if a hand is in progress; the new blinds will be used when the next hand starts.

6. **Transfer player in/out (unified)**  
   - `TransferPlayerIn`:
     - If `seat` is `Some(s)`, validate seat is free and within range. If occupied, return error.
     - If `seat` is `None`, find the first free seat (lowest index).
     - Insert player with given `player_id`, `stack`, `seat`.
     - Return assigned seat via `respond_to`.
   - `TransferPlayerOut`:
     - Remove player, return their stack. The broker’s room subscription remains (user stays as spectator).

7. **Elimination detection**  
   In `clear_board_and_start_next`:
   - After pot distribution, call `game_state.get_busted_players()` which returns `Vec<(PlayerId, ChipAmount)>` sorted by starting stack descending.
   - Map `PlayerId` → `UserId` (actor’s player data always contains the mapping; if not, log error and skip).
   - Attach `busted_players: Vec<(UserId, ChipAmount)>` to the `HandCompletedEvent`.
   - Remove busted players from `self.players`.
   - Do **not** start next hand; wait for `ResumeHand`.

8. **Broadcast**  
   Replace all direct user sends with `broker.broadcast_to_room(self.room_id, msg)`. The room subscribers are managed externally.

### 3.4 Database Schema, Transaction Rules & Unit of Work

**Migration** – unchanged from previous version (three tables: `tournaments`, `tournament_registrations`, `tournament_results`).

**Registration Atomicity**  
`TournamentRepo::register_player_txn(conn, tournament_id, user_id, buy_in)` must:
1. Deduct chips: `UserRepo::update_chip_balance_with_conn(conn, ctx, user_id, -buy_in)`.
2. `TournamentRepo::increment_prize_pool(conn, id, buy_in)`.
3. Insert registration row.
All within the same transaction opened by the caller (service layer) using `conn.begin().await`.

The service layer (`TournamentServiceImpl`) will fetch a `sea_orm::DatabaseConnection` from app state, start a transaction, call the txn method, and commit/rollback. `UserRepo` must expose a variant taking a connection (e.g., `update_chip_balance_txn`). This is a Phase 0 requirement: refactor `UserRepo` if necessary.

### 3.5 WebSocket Protocol Additions (With Concrete Types)

Add to `RoomMessage` enum in `sb-table-registry/src/game_room.rs`:

```rust
// New variant payload types defined in the same module or shared types:

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TournamentStateUpdate {
    pub tournament_id: TournamentId,
    pub status: TournamentStatus,
    pub registered_count: u32,
    pub max_players: u32,
    pub prize_pool: ChipAmount,
    pub blind_level: Option<BlindLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TournamentResultPayload {
    pub tournament_id: TournamentId,
    pub user_id: UserId,
    pub position: u32,
    pub prize: ChipAmount,
}

pub enum RoomMessage {
    // ... existing variants ...
    TournamentState(TournamentStateUpdate),
    TournamentRegistered { tournament_id: TournamentId, user_id: UserId },
    TournamentStarting { tournament_id: TournamentId, starts_in_seconds: u32 },
    TournamentBlindLevel { tournament_id: TournamentId, level: u32, small_blind: i64, big_blind: i64, ante: i64 },
    TournamentElimination { tournament_id: TournamentId, user_id: UserId, position: u32 },
    TournamentResult { tournament_id: TournamentId, results: Vec<TournamentResultPayload> },
    TournamentTableChanged { tournament_id: TournamentId, new_room_id: TableId, new_seat: u8 },
}
```

Client‑to‑server messages (added to WS handler):
- `register_tournament { tournament_id }`
- `unregister_tournament { tournament_id }`
- `spectate_tournament { tournament_id }` (frontend can send; not strictly required because we keep subscriptions)

### 3.6 REST Router Stubs

Create `sb-rest-router/src/tournament_routes.rs` with an axum `Router` that mounts under `/tournaments` and returns `501 Not Implemented` for all handlers. This will be filled by Agent 1.

### 3.7 GameState Extension – Starting Stack Tie‑Breaking

**File:** `sb-game-engine/src/game_state.rs`

Add a field `hand_start_stacks: HashMap<PlayerId, ChipAmount>` initialized in `new_hand`. Then:

```rust
/// Returns busted players (stack == 0) with their **starting stack** (at the beginning of the hand),
/// sorted descending by starting stack (larger starting stack => better finishing position).
pub fn get_busted_players(&self) -> Vec<(PlayerId, ChipAmount)> {
    let mut busted: Vec<_> = self.players.iter()
        .filter(|p| p.stack == ChipAmount::new(0).unwrap())
        .map(|p| (p.player_id, *self.hand_start_stacks.get(&p.player_id).unwrap_or(&ChipAmount::new(0).unwrap())))
        .collect();
    busted.sort_by(|a, b| b.1.cmp(&a.1));
    busted
}
```

The tournament actor receives this list in the correct finishing order and uses it directly.

### 3.8 Registry Modifications

**File:** `sb-table-registry/src/registry.rs`

Add:
```rust
pub struct TableHandle {
    pub table_id: TableId,
    pub cmd_tx: mpsc::Sender<InternalCommand>,
}

pub async fn create_tournament_table(
    &self,
    config: TableConfig,
    tournament_id: TournamentId,
    broker: Arc<ConnectionBroker>,
) -> Result<TableHandle, AppError> {
    // spawn actor, send EnterTournamentMode, store in maps,
    // wire to global event broadcast, return handle
}

pub async fn remove_room(&self, room_id: TableId) { ... }
```

Modify `spawn_room_reaper`: before reaping a room, check its mode (stored in the registry entry). If `Tournament`, skip it.

### 3.9 Logging & Observability Mandates (Structured)

All log events must use `tracing` and include at least `tournament_id` as a structured field. Examples:

- Tournament created: `info!(tournament_id = %tid, tournament_type = ?typ, max_players, buy_in, "tournament created");`
- Player registered: `info!(tournament_id = %tid, user_id = %uid, registered_count, "player registered");`
- Tournament start: `info!(tournament_id = %tid, "tournament started");`
- Blind level advance: `info!(tournament_id = %tid, old_level, new_level, small_blind, big_blind, "blind level advanced");`
- Elimination: `info!(tournament_id = %tid, user_id = %uid, position, "player eliminated");`
- Rebalance start/end: `info!(tournament_id = %tid, "rebalance started"); ... info!(tournament_id = %tid, "rebalance completed");`
- Final table merge: `info!(tournament_id = %tid, "final table merge");`
- Tournament complete: `info!(tournament_id = %tid, prize_pool, "tournament completed");`
- Crash recovery: `info!(tournament_id = %tid, "settling crashed tournament...");`

Errors at `error!` level with full context.

### 3.10 BlindScheduler Public API (Contract)

Define in `sb-tournament` (or a shared place) a trait or concrete struct that both phases use. The concrete API:

```rust
pub struct BlindScheduler {
    levels: Vec<BlindLevel>,
    current_level_index: usize,
    level_start: Instant,
    pending_advance: bool,
}

impl BlindScheduler {
    pub fn new(levels: Vec<BlindLevel>) -> Self;
    /// Call on each HandCompletedEvent. Returns Some(new_level, small_blind, big_blind, ante) if blinds advanced.
    pub fn on_hand_completed(&mut self) -> Option<(u32, ChipAmount, ChipAmount, i64)>;
    /// Force immediate level advance (for testing). Returns new blinds info.
    pub fn force_advance(&mut self) -> Option<(u32, ChipAmount, ChipAmount, i64)>;
    /// Current blinds.
    pub fn current_blinds(&self) -> (ChipAmount, ChipAmount, i64);
    /// Starts the real timer. In tests, this is not used; instead, `force_advance` is called manually.
    pub fn start_timer(&self) -> tokio::task::JoinHandle<()>;
}
```

The timer sets `pending_advance = true` every `level.duration_seconds`. The actual advance happens in `on_hand_completed`.

### 3.11 Error Variants

Extend `AppError` in `sb-shared-types` with tournament‑specific variants:

```rust
pub enum AppError {
    // existing...
    TournamentFull,
    TournamentAlreadyStarted,
    TournamentRegistrationClosed,
    TournamentNotRunning,
    InvalidSeat,
    // ...
}
```

This ensures clear, machine‑readable errors for the front‑end.

---

## 4. Phase 1: Sit & Go (Agent 1)

### 4.1 SitGoTournament Actor

Structure and lifecycle identical to the earlier spec, but with the following adjustments:

**Registration transaction** uses `repo.register_player_txn(conn, ...)` from a service‑provided connection. After successful registration, `broker.subscribe_to_room(tournament_id_as_room, user_id)` and broadcast `TournamentRegistered`.

**Start sequence**  
When `max_players` reached and status transitions to `Starting`:
- Wait `start_delay_seconds`.
- Create table via `registry.create_tournament_table(...)`.
- For each registered player (shuffled for random seat assignment):
  - Send `TransferPlayerIn` with `seat: Some(assigned_seat)` and a `oneshot` to get the actual seat (which will be the same, but we still collect).
  - Send `TournamentTableChanged { tournament_id, new_room_id: table_id, new_seat: assigned_seat }` to the player via broker.
- Send `ResumeHand { force_dealer_seat: None, respond_to }` to the table. Check for error (though there should be none).
- Start `BlindScheduler` timer.
- Set status `Running`.

**During play**  
Event loop: filter `HandCompletedEvent`s. Process `busted_players` in the given order (already sorted). For each:
  - Decrement `players_remaining`, record position, broadcast elimination.
  - If `players_remaining == 1`, trigger end.

Feed event to scheduler; if blinds advanced, send `SetBlinds` and broadcast `TournamentBlindLevel`. Then `ResumeHand`.

**End**  
Compute payouts, update results and chip balances, broadcast `TournamentResult`, shutdown table.

### 4.2 BlindScheduler Implementation

Implement the API from 3.10. The timer is a `tokio::spawn` loop that sets `pending_advance = true` and yields until the next level duration. For testing, the timer is not spawned; tests use `force_advance`.

### 4.3 PayoutCalculator

Same as before: pure function, remainder to first.

### 4.4 TournamentServiceImpl

Stores a `DashMap<TournamentId, mpsc::Sender<SitGoCommand>>`. In `register`, obtains a `DatabaseConnection` from state (e.g., `AppState`), starts a transaction, calls `repo.register_player_txn`, commits, then sends a command to the actor.

### 4.5 TournamentRepoImpl

Sea‑ORM implementation. Provides `register_player_txn` that uses the given `&DatabaseConnection` for all queries. Must also implement `increment_prize_pool` with a connection.

### 4.6 REST & WS Handlers

Implement the REST routes and WS client messages as per contracts.

### 4.7 Integration Test

6‑player S&G with deterministic bots. Use `blind_scheduler.force_advance()` to skip blind levels. Verify `TournamentTableChanged` messages after registration, correct payouts, and chip balances.

---

## 5. Phase 2: MTT (Agent 2)

### 5.1 MttDirector Actor

Similar to S&G but manages multiple tables. It holds:
- `table_handles: Vec<TableHandle>`.
- `player_assignments: HashMap<UserId, (TableId, seat)>`.
- `blind_scheduler: BlindScheduler`.
- state machine with `Pausing` and `Rebalancing` states.

**Initialization**  
After registration closes and start delay, create `N = ceil(max_players / 9)` tables. Randomly shuffle all players, distribute, and send `TransferPlayerIn` with `seat: Some(...)` for each, collecting seat assignments. Send `TournamentTableChanged` to each player. Start scheduler.

**During play**  
Filter events, process eliminations identically. After each hand, check if any table has ≤2 players and total players > 9; if so, transition to `Pausing`.

**Pausing / Rebalancing**  
Send `PauseHand` to all tables, wait for all `respond_to` callbacks. Then execute the rebalancer algorithm (5.2). For each move:
- `TransferPlayerOut` on source.
- `TransferPlayerIn` with `seat: None` on target (actor picks free seat). Collect returned seat.
- Send `TournamentTableChanged` to player with new room and seat.
After moves, shut down empty tables, then `ResumeHand` on survivors.

**Final Table Merge**  
When total players ≤9, pause all, collect all players, randomly assign seats on one table, transfer them in with `seat: Some(...)`, send `ResumeHand` with `force_dealer_seat: Some(random)` (and handle possible error if seat invalid, though it will be valid). Shut down others.

### 5.2 Rebalancer Algorithm (Exact)

Same algorithm as earlier, but it uses `TransferPlayerIn` with `seat: None` and receives assigned seat. The algorithm plans moves, then they are executed sequentially (or in parallel, but sequential is fine). Seat assignment for MTT moves is deterministic: the target table's actor assigns first free seat, so we don't need a complex seating plan; just move.

### 5.3 Final Table Merge

As described.

### 5.4 Blind Sync in MTT

`SetBlinds` sent to all tables when scheduler triggers. `pending_blind_advance` flag global.

### 5.5 Pause/Resume & Timeout Handling

`PauseHand` now includes a `respond_to` channel that the actor uses to confirm pause. The director waits for all acks before proceeding. This prevents deadlocks.

### 5.6 Integration Test

30‑player MTT, test rebalancing and final table merge, verify `TournamentTableChanged` messages.

---

## 6. Crash Recovery & Startup

Same logic as before, with idempotent settlement and structured logging.

---

## 7. Spectator Mode

Unchanged: eliminated players keep room subscription, continue receiving broadcasts.

---

## 8. Testing Strategy

Unit tests for PayoutCalculator, Rebalancer, BlindScheduler. Integration tests for full tournament flows.

---

## 9. Edge Cases & Guarantees

Summarized as before, plus:
- `TransferPlayerIn` with invalid seat returns error.
- `ResumeHand` with invalid dealer seat returns error, director must handle.
- Transactions guarantee atomic registration.

---

## 10. Implementation Order & Agent Briefs

**Phase 0 (Manual)** – must implement all foundation, including unified `TransferPlayerIn`, `ResumeHand` validation, error variants, logging mandates, and `BlindScheduler` API.  
**Phase 1 (Agent 1)** – implement S&G using provided API.  
**Phase 2 (Agent 2)** – implement MTT using Phase 1’s `BlindScheduler` and the unified commands.

---
