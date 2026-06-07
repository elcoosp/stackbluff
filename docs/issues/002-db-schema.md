---
title: Database schema (SQLite) – SeaORM 2.0 entities with typed JSON and active enums
labels: database, backend, afk
blocked_by: 001
---

## What to build

Create the **full SQLite schema** using SeaORM 2.0 migrations (in `backend/migration/`).  
Then generate SeaORM entities in a new crate `sb-db-entities` using **SeaORM 2.0’s `#[sea_orm::model]`** syntax with strongly‑typed JSON (no `serde_json::Value`) and `ActiveEnum` for all enum fields.

All tables must respect the **data model** defined in `stackbluff-architecture.md` §4.4 and additional tables required by the SRS (`subscription_events`, `player_ranks`, `mission_completions`, `referrals`).

---

### Required tables (complete spec)

| Table | Purpose |
|-------|---------|
| `users` | Core user profile, chip balance, streak, platform |
| `sessions` | Session token hash table (HTTP‑only cookies / JWT) |
| `hand_history` | Immutable hand record, JSON fields typed |
| `tables` | Active game tables (cash game and tournament) |
| `clubs` | Club entity |
| `club_memberships` | Many‑to‑many user ↔ club with weekly XP |
| `subscription_events` | **Full history** of subscription/payment events (BR‑013) |
| `player_ranks` | Season‑specific rank tier and points |
| `seasons` | Season definition (8‑week periods) |
| `mission_completions` | Daily mission completions |
| `referrals` | Referral tracking (double‑sided bonus) |
| `leaderboard_global_mv` | Materialised view for global leaderboard (refreshed every 5 min) |

> **Note:** The `leaderboard_global_mv` is a **materialised view** – implement it as a regular table that a scheduled job truncates and refills. SeaORM does not support materialised views natively; we create the table and handle refresh in application code.

---

### SeaORM 2.0 requirements

1. **Entity definition** – Use `#[sea_orm::model]` macro with relations defined **inside the `Model` struct** (no separate `Relation` enum or `Related` impl).  
   See `references/entity-patterns.md` in the skill guide.

2. **Strongly‑typed JSON** – For all JSON columns (`players_json`, `actions_json`, `result_json`, `config_json`, `pro_settings_json`):
   - Define **dedicated Rust structs** that implement `FromQueryResult` and `Serialize`/`Deserialize`.
   - Use `#[sea_orm(column_type = "Json")]` on the field.
   - **Do not** use `serde_json::Value` in entities – that would lose compile‑time safety.

   **Example:**
   ```rust
   #[derive(Clone, Debug, PartialEq, Serialize, Deserialize, FromJsonQueryResult)]
   pub struct HandPlayers {
       pub seats: Vec<HandPlayer>,
   }
   ```

3. **Active enums** – For `users.platform`, `tables.status`, `subscription_events.event_type` etc.:
   - Use `#[derive(sea_orm::ActiveEnum)]` on a Rust enum.
   - The migration must use the same enum variant names and DB representation.
   - **Keep entity and migration in sync** – the migration can import the enum.

4. **Foreign keys & constraints** – Enable `PRAGMA foreign_keys = ON` in SQLite.  
   - `users.chip_balance` must have a `CHECK (chip_balance >= 0)`.
   - Referential actions: `ON DELETE CASCADE` where appropriate (e.g., sessions → users).

5. **Write serialisation note** – SQLite is single‑writer via an `mpsc` channel (arch ADR‑002).  
   The schema must be **WAL‑friendly** – no long‑running read transactions that block checkpoints.

---

### Migration structure

- All migrations under `backend/migration/src/`.
- Each migration is **additive** (no destructive column drops until a later cleanup migration).
- Migrations **use the enums defined in `sb-db-entities`** (or in a shared crate) – do not duplicate enum definitions in raw SQL strings.
- Example of using an enum in a migration:
  ```rust
  use sea_orm_migration::prelude::*;
  use sb_db_entities::user::Platform;

  fn up(manager: &SchemaManager) -> Result<(), DbErr> {
      manager
          .create_table(
              Table::create()
                  .table(Users::Table)
                  .col(
                      ColumnDef::new(Users::Platform)
                          .enumeration(Platform::name(), Platform::iter().map(|v| v.to_value()))
                          .not_null()
                          .default(Platform::PWA.to_value()),
                  )
                  // ...
          )
          .await
  }
  ```

- Provide `down` for all migrations (reversible).

---

### Entity generation

Do **not** use `sea-orm-cli generate entity` blindly – it produces old‑style entities.  
Instead, **write the entities manually** following the 2.0 pattern.

Create a new crate `sb-db-entities` with:
- `lib.rs` – re‑exports of all entity modules.
- Each entity in its own module (e.g. `user.rs`, `club.rs`).
- **Relations** defined inside the `Model` struct using `HasOne`, `HasMany`, `BelongsTo`, etc.

**Example entity (`user.rs`):**
```rust
use sea_orm::entity::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm::model]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub telegram_id: Option<i64>,
    #[sea_orm(unique)]
    pub email: Option<String>,
    pub display_name: String,
    #[sea_orm(column_type = "BigInteger")]
    pub chip_balance: i64,
    pub streak_count: i32,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
    pub platform: Platform,
    pub email_verified_at: Option<DateTimeUtc>,

    // Relations
    #[sea_orm(has_many)]
    pub sessions: HasMany<super::session::Entity>,
    #[sea_orm(has_many)]
    pub club_memberships: HasMany<super::club_membership::Entity>,
    // ...
}
```

---

### Acceptance criteria

- [ ] All tables from the architecture document **and** SRS are present (see list above).
- [ ] Migrations are **reversible** (each `up` has a corresponding `down`).
- [ ] Foreign key constraints are enforced with appropriate `ON DELETE` actions.
- [ ] `users.chip_balance` has a `CHECK (chip_balance >= 0)` constraint.
- [ ] **No** `serde_json::Value` appears in any entity field. All JSON columns use a dedicated `FromJsonQueryResult` struct.
- [ ] Enums (`Platform`, `TableStatus`, `SubscriptionEventType`) use `#[derive(ActiveEnum)]` and are **shared** between migration and entity.
- [ ] Entity relations are defined **inside the `Model`** using the 2.0 syntax (`HasOne`, `HasMany`).
- [ ] The `sessions` table stores a **hash** of the session token (not the raw token), with `token_hash TEXT PRIMARY KEY`.
- [ ] The `subscription_events` table records **all** events (start, renew, cancel, expiry) as required by BR‑013.
- [ ] The materialised view `leaderboard_global_mv` is implemented as a regular table with a refresh function (migration creates the table; application code handles refresh).
- [ ] All UUID columns use `Uuid` from the `uuid` crate (format `uuid-v7` or `uuid-v4`). The `sb_shared_types` crate (issue #001) provides the common `Uuid` wrapper.

---

### Blocked by

**#001** – Shared types (Uuid, custom error types, etc.) must be defined before entities can reference them.

---

### Additional notes for the implementer

- **Write serialisation:** The schema is designed for the single‑writer `mpsc` pattern. Avoid `AUTOINCREMENT` in SQLite; use `DEFAULT (uuid_v7())` for primary keys if you want time‑ordered IDs.
- **Indexes:** Add indexes on foreign keys (`user_id`, `club_id`, `table_id`), on `hand_history.played_at` for archival, and on `users.telegram_id` for fast lookup.
- **JSON validation:** Use `serde_json::from_str::<YourStruct>()` when reading from the database. The migration should ensure the JSON is well‑formed, but structural correctness is the application’s responsibility.
- **Testing:** Write a simple test that applies all migrations up and down, then loads a few rows using the generated entities. This test lives in `sb-db-entities/tests/`.

---

### References

- `stackbluff-architecture.md` – §4.4 Data Model, §5.3 Database Migration Strategy.
- `stackbluff-srs.md` – REQ-FUNC‑092 (subscription history), BR‑013 (full event log).
- SeaORM 2.0 skill – `SKILL.md` and its references (`entity-patterns.md`, `activemodel-patterns.md`, `migration-guide.md`).
