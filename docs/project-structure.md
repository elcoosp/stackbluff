# StackBluff — Modular Project Structure

## Complete Project Tree

```
stackbluff/
│
├── backend/                                        # ═══ Rust Cargo Workspace ═══
│   ├── Cargo.toml                                  # [A1] Workspace root
│   ├── Cargo.lock                                  # [A1]
│   ├── rust-toolchain.toml                         # [A1] Pins Rust 1.81
│   ├── deny.toml                                   # [A5]
│   ├── asyncapi.yaml                               # [A1] WS message spec (Single Source of Truth)
│   └── crates/
│       │
│       ├── sb-shared-types/                        # [A1] Domain primitives (CLOSED, NO infra deps)
│       │   ├── Cargo.toml
│       │   └── src/
│       │       ├── lib.rs
│       │       ├── ids.rs                          #    UserId, TableId, ClubId, PlayerId
│       │       ├── chips.rs                        #    ChipAmount (i64, checked_add enforced)
│       │       ├── cards.rs                        #    Card, Suit, Rank, HandRank
│       │       ├── game_types.rs                   #    TableConfig, StakeLevel, GameVariant
│       │       ├── request_context.rs              #    RequestContext (RequestId, user_id only)
│       │       ├── logging.rs                      #    sb_log! macro
│       │       └── errors.rs                       #    Stable AppError
│       │
│       ├── sb-contracts/                           # [A1] ★ THE INTERFACE LAYER ★
│       │   ├── Cargo.toml                          #    Depends ONLY on sb-shared-types
│       │   └── src/
│       │       ├── lib.rs
│       │       ├── repo_api.rs                     #    Data access traits
│       │       ├── persistence_error.rs            #    Domain-defined DB error taxonomy
│       │       ├── service_api.rs                  #    Command/Query traits
│       │       └── async_hooks.rs                  #    Async side-effect traits
│       │
│       ├── sb-ws-messages/                         # [A1] AUTO-GENERATED from asyncapi.yaml
│       │   ├── Cargo.toml                          #    Uses asyncapi-codegen in build.rs
│       │   ├── build.rs
│       │   └── src/
│       │       └── lib.rs                          #    WS JSON payload types
│       │
│       ├── sb-db-repos/                            # [A1] Implements sb-contracts::repo_api
│       │   ├── Cargo.toml
│       │   └── src/
│       │       ├── lib.rs                          #    Spawns sequential DB writer loop
│       │       ├── writer_loop.rs                  #    SAVEPOINTs for 1-txn batching + isolation
│       │       ├── commands.rs                     #    DbCommand includes RequestContext
│       │       ├── read_cache.rs                   #    Internal Moka cache for AntiCheat velocity
│       │       ├── user_repo.rs                    #    Sends DbCommand, awaits oneshot
│       │       ├── anti_cheat_repo.rs              #    Reads from Moka cache
│       │       └── ...
│       │
│       ├── sb-db-entities/                         # [A1] SeaORM entity definitions
│       ├── sb-game-engine/                         # [A1] Pure stateless poker logic
│       ├── sb-table-registry/                      # [A1] Actor runtime & state management
│       │   └── src/
│       │       ├── actor.rs                        #    Explicit state-loop (Yields correctly)
│       │       └── registry.rs                     #    Reaper (cleans WS sessions)
│       ├── sb-ws-handler/                          # [A1] broadcast::Sender routing
│       ├── sb-auth/                                # [A1]
│       ├── sb-rest-router/                         # [A1]
│       ├── sb-oracle/                              # [A1]
│       ├── sb-club/                                # [A3]
│       ├── sb-bot-handler/                         # [A3]
│       ├── sb-payment/                             # [A3]
│       ├── sb-notification/                        # [A3]
│       ├── sb-mission/                             # [A4]
│       ├── sb-viral/                               # [A4]
│       ├── sb-anti-cheat/                          # [A5]
│       └── sb-server/                              # [A1] Binary Crate
│
├── backend/migration/                              # [A1] SeaORM migrations (CHECK constraints)
├── frontend/                                       # ═══ pnpm Monorepo ═══
├── tests/                                          # [A5]
├── scripts/                                        # [A5]
├── docs/                                           # [A1]
├── infra/                                          # [A5]
├── .github/                                        # [A5]
├── justfile                                        # [A5]
└── README.md                                       # [A1]
```
