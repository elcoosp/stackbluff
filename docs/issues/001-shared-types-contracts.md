---
title: Shared types and core contract traits (sb-shared-types, sb-contracts)
labels: backend, contract, hitl
blocked_by: []
---

## What to build

Create the foundational crates that define all shared types and cross-module interfaces:

**`backend/crates/sb-shared-types/`** (Agent 1 – closed domain primitives, no infra deps):
- `ids.rs` – `UserId`, `TableId`, `ClubId`, `PlayerId` (newtype wrappers around `Uuid`).
- `chips.rs` – `ChipAmount` (i64, `checked_add` enforced, no negative).
- `cards.rs` – `Card`, `Suit`, `Rank`, `HandRank` (with hand evaluation utilities).
- `game_types.rs` – `TableConfig`, `StakeLevel`, `GameVariant`, `ActionType`.
- `request_context.rs` – `RequestContext` containing `request_id` (Uuid) and `user_id`.
- `logging.rs` – `sb_log!` macro for structured logging with context.
- `errors.rs` – `AppError` enum (stable across all modules).

**`backend/crates/sb-contracts/`** (Agent 1 – pure interface layer, depends only on `sb-shared-types`):
- `repo_api.rs` – data access traits (`UserRepo`, `HandHistoryRepo`, `ClubRepo`, etc.).
- `service_api.rs` – command/query traits (`TableService`, `AuthService`, `PaymentService`, `ViralService`, `MissionService`, `AntiCheatService`).
- `persistence_error.rs` – `PersistenceError` taxonomy (Transient, ConstraintViolation, Fatal).
- `async_hooks.rs` – traits for async side-effects (`NotificationHook`, `ViralHook`, `AuditHook`).

**`backend/migration/`** (Agent 1) – SeaORM migration scaffolding, empty stub.

## Acceptance criteria

- [ ] `cargo check` succeeds for both crates with no warnings.
- [ ] No dependency on `sqlx`, `tokio`, or any async runtime in `sb-shared-types`.
- [ ] `PersistenceError` has three variants: `Transient(String)`, `ConstraintViolation(String)`, `Fatal(String)`.
- [ ] `RequestContext` includes `request_id` (Uuid) and `user_id` (Option<UserId>).
- [ ] Migration scaffolding can generate a blank migration.

## Blocked by

None – can start immediately.
