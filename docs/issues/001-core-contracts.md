---
title: Define core API contracts and ownership boundaries
labels: backend, contract, hitl
blocked_by: []
---

## What to build

Create the shared contract files that all agents will use to communicate without touching each other’s code. This includes:

- `src/contracts.rs` (Rust) – trait definitions for `TableApi`, `PaymentApi`, `NotificationApi`, `ViralApi`, `AntiCheatApi`, etc.
- `packages/shared/types/index.ts` (TypeScript) – shared game types (Card, HandRank, PlayerAction, etc.) and platform‑agnostic interfaces (PlatformAPI).
- `migration/src/` – empty placeholder with SeaORM migration scaffolding.

These files belong to **Agent 1** (Architect). Once merged, all other agents can implement the traits in their own modules without ever touching these files again.

## Acceptance criteria

- [ ] `src/contracts.rs` compiles with `#![allow(unused)]` and defines empty trait stubs for all required cross‑module communication.
- [ ] `packages/shared/types/index.ts` exports TypeScript enums and interfaces for Card, Suit, Rank, HandRank, ActionType, TableConfig, etc.
- [ ] Migration scaffolding is ready (`migration/src/lib.rs`, `migration/src/m20260601_000001_create_users.rs` stub).
- [ ] A short `README.md` inside `docs/contracts.md` documents which traits belong to which agent.

## Blocked by

None – can start immediately.
