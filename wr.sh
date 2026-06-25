#!/usr/bin/env bash
set -euo pipefail
WT="$(pwd)/../stackbluff-worktrees/issue-24"
cd "$WT"

echo "=== Force push branch ==="
git push origin issue-24 --force

echo ""
echo "=== Create PR ==="
gh pr create \
  --base main \
  --title "feat(tournament): implement MTT & S&G tournament system (Phases 0-2)" \
  --body '## Summary

Implements the full tournament system (Sit & Go + Multi‑Table Tournament) per the Tournament System Architecture v3.0 specification. Spans Phase 0 (Foundation), Phase 1 (S&G), and Phase 2 (MTT), integrating deeply into the existing poker backend without forking core modules.

## Architecture

```
sb-server (wires TournamentService, REST/WS routes, crash recovery)
  |
  v
sb-tournament (NEW)
  ├── TournamentServiceImpl (manages actor map)
  ├── SitGoTournament actor
  ├── MttDirector actor
  ├── BlindScheduler (timer-driven level progression)
  ├── PayoutCalculator (pure function, remainder-to-first)
  ├── Rebalancer (algorithm for table balancing and final merge)
  └── Crash Recovery (startup settlement of Running tournaments)
        | uses
        v
sb-table-registry (EXTENDED)
  ├── ConnectionBroker (global user+room message routing)
  ├── Registry (create_tournament_table, remove_room, reaper skip)
  ├── HandCompletedEvent (includes busted_players with starting stacks)
  └── TableActor (TableMode, 6 new InternalCommands, elimination detection,
                  broker-integrated broadcasting)
        | uses
        v
sb-game-engine (EXTENDED)
  └── GameState::get_busted_players() (starting-stack tie-breaking)
```

## Changes by Phase

### Phase 0 – Foundation (Manual)
- **`TournamentId` + 5 `AppError` variants** – new types in `sb-shared-types`
- **Tournament contracts** – `TournamentService` and `TournamentRepo` traits with full config/result types in `sb-contracts`
- **ConnectionBroker** – global message router with room subscriptions (unit tested)
- **TableActor extensions** – `TableMode` enum, `SetBlinds`, `PauseHand`, `ResumeHand`, `TransferPlayerIn/Out`, `EnterTournamentMode` commands; tournament‑mode blind selection, auto‑start suppression, rebuy rejection, elimination detection via `get_busted_players`; **broker-integrated broadcasting** with fallback to `user_senders` for cash games
- **`HandCompletedEvent`** – extended with `busted_players` field
- **`GameState::get_busted_players()`** – returns busted players sorted by starting stack (tie‑breaking), with unit test
- **WS messages** – 7 new `RoomMessage` variants for tournament lifecycle
- **Registry** – `create_tournament_table`, `remove_room`, reaper skips tournament rooms
- **DB migration** – `tournaments`, `tournament_registrations`, `tournament_results` tables with unique index
- **REST stubs** – 6 tournament endpoints (later fully implemented)
- **`BlindScheduler`** – timer‑driven blind progression with `force_advance` for testing (unit tested)
- **`PayoutCalculator`** – pure function with remainder‑to‑first (unit tested)
- **Transactional `UserRepo`** – `update_chip_balance_with_conn` method for atomic registration

### Phase 1 – Sit & Go
- **`SitGoTournament` actor** – full lifecycle: register/unregister, pending‑start flow, auto‑start with background delay, random seating, blind scheduling, elimination tracking via `busted_players`, payout crediting, WS event broadcasting
- **`TournamentRepoImpl`** – Sea‑ORM based CRUD with transactional registration
- **`TournamentServiceImpl`** – actor registry with `DashMap`‑based routing
- **Integration tests** – registration message flow, overflow rejection

### Phase 2 – MTT
- **`MttDirector` actor** – multi‑table lifecycle: table creation, player distribution, `Pausing`/`Rebalancing` states, rebalance after hand when any table ≤ 2 and total > 9, final table merge when total ≤ 9, blind sync across all tables
- **`Rebalancer`** – `compute_rebalance_moves` and `compute_final_table_moves` algorithms (unit tested)
- **`TournamentServiceImpl`** unified for both S&G and MTT

### Additional Spec Compliance
- **WS handler** – client messages `register_tournament`, `unregister_tournament`, `spectate_tournament` implemented
- **REST endpoints** – full CRUD for tournaments with proper error mapping
- **Crash recovery** – `settle_crashed_tournaments` runs on server startup, refunds buy‑ins and marks Running tournaments as Cancelled (spec §6)
- **Structured logging** – `info!`/`error!` with `tournament_id` for all key lifecycle events (spec §3.9)
- **Spectator mode** – eliminated players keep broker subscriptions and continue receiving broadcasts (spec §7)

## Testing

### Unit Tests (11 total)
- `BlindScheduler`: initial blinds, force advance, max level, timer‑driven advance
- `PayoutCalculator`: standard 3‑player, remainder‑to‑first
- `Rebalancer`: moves from small tables, no rebalance when all large, final table consolidation
- `ConnectionBroker`: broadcast delivery, unsubscribe stops delivery

### Integration Tests (2)
- `test_sit_go_registration_messages_flow` – verifies `TournamentRegistered` messages
- `test_registration_full_rejects_overflow` – confirms `TournamentFull` rejection

### Running Tests
```bash
cd backend
cargo test --all-features        # all tests pass (0 failures)
cargo clippy --all-targets --all-features -- -D warnings   # zero warnings
```

## Spec Compliance

| Section | Requirement | Status |
|---------|-------------|--------|
| 3.1 | TournamentId, contracts | ✅ |
| 3.2 | ConnectionBroker | ✅ |
| 3.3 | TableActor extensions + broker broadcasting | ✅ |
| 3.4 | DB migration + transactional UserRepo | ✅ |
| 3.5 | WS protocol additions | ✅ |
| 3.6 | REST router stubs | ✅ |
| 3.7 | GameState::get_busted_players | ✅ |
| 3.8 | Registry extensions | ✅ |
| 3.9 | Structured logging | ✅ |
| 3.10 | BlindScheduler API | ✅ |
| 3.11 | Error variants | ✅ |
| 4.1-4.7 | Sit & Go (full) | ✅ |
| 5.1-5.6 | MTT (full) | ✅ |
| 6 | Crash recovery | ✅ |
| 7 | Spectator mode | ✅ |
| 8 | Testing strategy | ✅ |
| 9 | Edge cases | ✅ |

## Checklist

- [x] Tests pass
- [x] Quality gates pass (fmt, clippy, type-check)
- [x] Atomic commits with clear messages
- [x] No debug/temp code left
- [x] All spec sections 3-9 addressed

Closes #24'

echo "✅ PR created"
gh pr view --web
