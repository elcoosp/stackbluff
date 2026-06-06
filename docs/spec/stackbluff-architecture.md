# StackBluff — Architecture & Design Specification

| Field | Value |
|-------|-------|
| Project | StackBluff |
| Document | L3 — Architecture & Design Specification |
| Version | 0.1 (Draft) |
| Date | 2026-06-06 |
| Author | Founder, assisted by AI |
| Status | Draft — Pending Review |
| Traces to | stackbluff-srs.md v0.1 |

---

## 1. Context & Scope

This document describes the architecture of the StackBluff platform: a multi-platform social poker service built for viral growth on near-zero infrastructure budget. The design must simultaneously satisfy aggressive performance targets (< 10ms WebSocket latency), GDPR compliance, cosmetic monetisation mechanics, and a critical constraint unique to this project: **the entire codebase is written by 5 parallel AI agents with zero merge conflicts by design**.

Every architectural decision in this document is driven by one or more Architecturally Significant Requirements (ASRs) extracted from the SRS. The architecture prefers reversible decisions and defers irreversible ones to the last responsible moment.

---

## 2. Goals & Non-Goals (Architecture Level)

### Architecture Goals

| ID | Goal | ASR Trace |
|---|---|---|
| AG-1 | Zero merge conflicts under 5-agent parallel development | Constraint |
| AG-2 | Sub-10ms WebSocket action latency at p99 under 1 000 concurrent tables | REQ-NFR-PERF-001 |
| AG-3 | Horizontal scalability to 300 000 DAU with infrastructure cost ≤ 0.5% of MRR | BG-007, REQ-NFR-PERF-002 |
| AG-4 | Isolation between game table instances (failure non-propagation) | REQ-NFR-REL-002 |
| AG-5 | Core bundle ≤ 2 MB on both PWA and Telegram Mini App | REQ-NFR-PERF-005, 006 |
| AG-6 | GDPR-compliant data architecture: EU residency, deletion, no PII in logs | REQ-NFR-COMP-001–005 |
| AG-7 | Single backend serving both PWA and Telegram Mini App via platform abstraction | Constraint, Grill §1 |
| AG-8 | SQLite WAL sufficient to Month 6 (~10 000 DAU) with a documented migration path | TBD-005 |

### Architecture Non-Goals

- No microservices topology at launch — a well-structured monolith suffices for 10 000 DAU.
- No Kubernetes or container orchestration until Month 6.
- No GraphQL — REST + WebSocket is sufficient and simpler for AI agents to implement consistently.
- No event sourcing / CQRS — table actor state machine is sufficient; SQLite WAL provides durability.
- No read replicas until > 10 000 DAU.

---

## 3. Architecturally Significant Requirements (ASRs)

| ID | Source | Statement | Category |
|---|---|---|---|
| ASR-PERF-001 | REQ-NFR-PERF-001 | WebSocket action latency p99 ≤ 10ms under 1 000 concurrent tables | Performance |
| ASR-PERF-002 | REQ-NFR-PERF-005 | Core PWA bundle ≤ 2 MB; time-to-interactive ≤ 3s on mobile 4G | Performance |
| ASR-PERF-003 | REQ-NFR-PERF-009 | SQLite WAL handles ≥ 500 writes/second | Performance |
| ASR-REL-001 | REQ-NFR-REL-002 | Crash of a single table actor never affects other tables | Reliability |
| ASR-REL-002 | REQ-NFR-REL-001 | ≥ 99.5% monthly uptime | Reliability |
| ASR-SEC-001 | REQ-NFR-SEC-004 | Server is sole source of truth; hole cards never transmitted to wrong client | Security |
| ASR-SEC-002 | REQ-NFR-SEC-001 | TLS 1.3 minimum on all connections | Security |
| ASR-SCALE-001 | BG-007 | Infra cost ≤ 0.5% of MRR at 300 000 DAU | Scalability |
| ASR-MOD-001 | Constraint | 5 AI agents work in parallel with zero merge conflicts | Modularity |
| ASR-COMP-001 | REQ-NFR-COMP-003 | All data stored on EU Hetzner infrastructure | Compliance |
| ASR-MON-001 | REQ-NFR-REL-005 | Error rate > 1% triggers automated Telegram alert within 5 minutes | Observability |

---

## 4. The Design

### 4.1 System Overview

StackBluff is a **modular monolith** deployed on a single Hetzner VPS (Months 1–6), designed with component boundaries clean enough to extract into separate services if scaling demands it. The core insight driving all structural decisions: **a Rust actor-per-table model achieves 10× the concurrency density of a Node.js equivalent**, making horizontal scaling unnecessary until well past 10 000 DAU.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Hetzner CAX11 (EU)                       │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Axum HTTP/WebSocket Server                 │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │    │
│  │  │  REST Router  │  │  WS Handler  │  │  Bot Router │  │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │    │
│  │         │                 │                  │          │    │
│  │  ┌──────▼─────────────────▼──────────────────▼──────┐  │    │
│  │  │              Application Core Layer               │  │    │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │    │
│  │  │  │  Auth    │ │  Lobby   │ │  Anti-cheat      │  │  │    │
│  │  │  │  Module  │ │  Module  │ │  Module          │  │  │    │
│  │  │  └──────────┘ └──────────┘ └──────────────────┘  │  │    │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │    │
│  │  │  │  Club    │ │  Season/ │ │  Oracle (Heuristic│  │  │    │
│  │  │  │  Module  │ │  League  │ │  Engine)         │  │  │    │
│  │  │  └──────────┘ └──────────┘ └──────────────────┘  │  │    │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │    │
│  │  │  │  Payment │ │  Mission │ │  Notification    │  │  │    │
│  │  │  │  Module  │ │  Module  │ │  Module          │  │  │    │
│  │  │  └──────────┘ └──────────┘ └──────────────────┘  │  │    │
│  │  └───────────────────────┬───────────────────────────┘  │    │
│  │                          │                               │    │
│  │  ┌───────────────────────▼───────────────────────────┐  │    │
│  │  │           Table Actor Registry (Tokio)             │  │    │
│  │  │  Table₁ Task │ Table₂ Task │ … │ TableN Task      │  │    │
│  │  │  (isolated Tokio tasks; mpsc channels to/from)     │  │    │
│  │  └───────────────────────┬───────────────────────────┘  │    │
│  │                          │                               │    │
│  │  ┌───────────────────────▼───────────────────────────┐  │    │
│  │  │              Data Layer                           │  │    │
│  │  │  SQLite WAL (write-serialised via mpsc)           │  │    │
│  │  │  SeaORM entities │ sqlx compile-time checked queries│  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┼─────────────────┐
              ▼              ▼                  ▼
        Cloudflare R2   Telegram Bot API    Stripe / Stars
        (cold archive)  (outbound notify)   (payment webhooks)
```

---

### 4.2 C4 Model

#### C4 Level 1 — System Context

```
[User: Telegram]──────────► [Telegram Platform] ──────────► [StackBluff System]
[User: PWA browser] ────────────────────────────────────────►  (Hetzner EU VPS)
[User: Mobile PWA] ──────────────────────────────────────────►
                                                                      │
                                                    ┌─────────────────┼────────────────┐
                                                    ▼                 ▼                ▼
                                              [Cloudflare CDN]  [Stripe/Stars]  [Sentry/Grafana]
```

#### C4 Level 2 — Container Diagram

| Container | Technology | Responsibility |
|---|---|---|
| **Axum Server** | Rust, Axum 0.8.9, Tokio 1.52.3 | HTTP API, WebSocket upgrade, Telegram Bot webhook, static file serving |
| **React SPA (PWA build)** | React 19.2.7, Vite 8.0.8, TypeScript 6.0 | Full PWA experience; React Router; Web Push subscription |
| **React SPA (Mini App build)** | Same SPA, Mini App feature flag | No router; modal/panel stack; Telegram.WebApp API calls |
| **SQLite WAL Database** | SQLite 3.54+, SeaORM 2.0 | Persistent state for users, chips, hand history (≤ 30 days), clubs, seasons |
| **Cloudflare R2** | Object storage | Archived hand histories (> 30 days), generated replay card images |
| **Shared Package** (`@stackbluff/shared`) | TypeScript | Shared game logic, Zustand stores, UI components, platform abstraction interface |

#### C4 Level 3 — Key Components (Backend)

| Component | Module Boundary | Agent Ownership |
|---|---|---|
| `game_engine` | Poker hand evaluator, deck, game state machine, timer | Agent 1 |
| `table_registry` | Table actor spawn/despawn, player connection routing | Agent 1 |
| `ws_handler` | WebSocket upgrade, session binding, message dispatch | Agent 1 |
| `auth_module` | JWT/session creation, Telegram initData validation, Argon2 | Agent 1 |
| `rest_router` | Lobby, profile, leaderboard, club CRUD REST routes | Agent 1 |
| `bot_handler` | Telegram Bot API: /poker command, result broadcasts, reminders | Agent 3 |
| `payment_module` | Stripe + Stars webhook validation, chip crediting, 2-phase commit | Agent 3 |
| `club_module` | Club CRUD, leaderboard materialised view, tournament scheduling | Agent 1 |
| `oracle_engine` | Heuristic hand analysis, template selection and rendering | Agent 1 |
| `notification_module` | Platform-agnostic `PlatformAPI` routing to Bot API / Web Push | Agent 3 |
| `anti_cheat_module` | Chip velocity tracking, IP/fingerprint collusion detection | Agent 5 |
| `mission_module` | Daily mission generation, completion tracking, streak counter | Agent 1 |
| `viral_module` | Replay card generation, referral link creation and attribution | Agent 4 |

---

### 4.3 Agent Ownership & Zero-Merge-Conflict Design

The architecture enforces a strict ownership boundary: **each source file and database migration belongs to exactly one agent**. Agents communicate exclusively through typed interfaces defined in a shared contracts file (`src/contracts.rs` or `src/ports.rs`).

**Module ownership by agent:**

| Agent | Owns (Backend) | Owns (Frontend) |
|---|---|---|
| Agent 1 (Architect) | `game_engine/`, `table_registry/`, `ws_handler/`, `auth_module/`, `rest_router/`, `club_module/`, `oracle_engine/`, `mission_module/` | — |
| Agent 2 (Frontend) | — | `apps/pwa/`, `apps/mini-app/`, `packages/shared/components/`, `packages/shared/stores/` |
| Agent 3 (Platform) | `bot_handler/`, `payment_module/`, `notification_module/` | `packages/shared/platform/` (PlatformAPI) |
| Agent 4 (Growth) | `viral_module/` | `apps/landing/`, `packages/shared/analytics/` |
| Agent 5 (QA/Ops) | `anti_cheat_module/`, `scripts/`, `tests/` | `packages/shared/test-utils/` |

**Interface contract pattern:**

```rust
// src/contracts.rs — shared by all modules, owned by Agent 1
// NO IMPLEMENTATION — only trait definitions and data types

pub trait TableApi: Send + Sync {
    async fn create_table(&self, config: TableConfig) -> Result<TableId, AppError>;
    async fn join_table(&self, table_id: TableId, player_id: PlayerId) -> Result<(), AppError>;
    // ...
}

pub trait PaymentApi: Send + Sync {
    async fn credit_chips(&self, user_id: UserId, amount: ChipAmount, source: PaymentSource) -> Result<(), AppError>;
}

pub trait NotificationApi: Send + Sync {
    async fn send(&self, user_id: UserId, event: NotificationEvent) -> Result<(), AppError>;
}
```

Each agent implements its owned trait in its owned directory. Zero shared mutable state across module boundaries. All cross-module calls go through these traits — enabling Agent 3 to swap the notification backend without touching Agent 1's code.

---

### 4.4 Data Model (Key Tables)

```sql
-- Core user state
users(id UUID PK, telegram_id BIGINT UNIQUE, email TEXT UNIQUE, display_name TEXT,
      chip_balance INTEGER NOT NULL DEFAULT 0, streak_count INTEGER DEFAULT 0,
      created_at TIMESTAMP, updated_at TIMESTAMP)

-- Immutable hand record
hand_history(id UUID PK, table_id UUID, played_at TIMESTAMP, players JSONB,
             actions JSONB, result JSONB, is_archived BOOLEAN DEFAULT FALSE)

-- Active game table
tables(id UUID PK, created_by UUID FK, config JSONB, status TEXT,
       club_id UUID FK NULLABLE, created_at TIMESTAMP)

-- Club system
clubs(id UUID PK, owner_id UUID FK, name TEXT, created_at TIMESTAMP,
      is_founder_club BOOLEAN DEFAULT FALSE)
club_memberships(user_id UUID, club_id UUID, joined_at TIMESTAMP, weekly_xp INTEGER)

-- Season & rank
seasons(id INT PK, name TEXT, starts_at TIMESTAMP, ends_at TIMESTAMP)
player_ranks(user_id UUID, season_id INT, rank_tier TEXT, rank_points INTEGER,
             PRIMARY KEY (user_id, season_id))

-- Subscription history (full event log, never truncated)
subscription_events(id UUID PK, user_id UUID, product TEXT, event_type TEXT,
                    occurred_at TIMESTAMP, payment_id TEXT)

-- Materialised view (refreshed every 5 min via scheduled job)
leaderboard_global_mv(user_id UUID, display_name TEXT, total_chips_won INTEGER,
                      rank_position INTEGER, refreshed_at TIMESTAMP)

-- Referral tracking
referrals(referrer_id UUID, referred_id UUID, completed_at TIMESTAMP NULLABLE,
          bonus_credited BOOLEAN DEFAULT FALSE)

-- Daily missions
mission_completions(user_id UUID, mission_type TEXT, completed_date DATE,
                    PRIMARY KEY (user_id, mission_type, completed_date))
```

**Write serialisation pattern:**

```rust
// Single mpsc sender shared across all modules
// Only one task writes to SQLite at a time
let (db_tx, db_rx) = tokio::sync::mpsc::channel::<DbCommand>(1024);

// All modules send write commands through this channel
// The DB worker task owns the SQLite connection and processes writes sequentially
tokio::spawn(async move {
    while let Some(cmd) = db_rx.recv().await {
        cmd.execute(&conn).await;
    }
});
```

---

### 4.5 Frontend Architecture

**Monorepo structure:**

```
stackbluff/
├── apps/
│   ├── pwa/              # Full PWA (React Router, service worker, Web Push)
│   └── mini-app/         # Telegram Mini App (no router, Telegram.WebApp API)
├── packages/
│   ├── shared/
│   │   ├── components/   # Shared UI components (shadcn/ui + custom)
│   │   ├── stores/       # Zustand stores (game state, user, club)
│   │   ├── platform/     # PlatformAPI abstraction (Telegram vs PWA)
│   │   ├── game-logic/   # Shared hand evaluation utils (TypeScript, not Rust)
│   │   └── analytics/    # Analytics event tracking (owned by Agent 4)
│   └── test-utils/       # Shared testing utilities (owned by Agent 5)
├── pnpm-workspace.yaml
└── biome.json            # Single Biome config (replaces ESLint + Prettier)
```

**Platform abstraction (PlatformAPI):**

```typescript
// packages/shared/platform/index.ts
export interface PlatformAPI {
  getUser(): TelegramUser | null;
  sendPayment(product: Product): Promise<PaymentResult>;
  subscribeToNotifications(): Promise<void>;
  shareContent(card: ShareCard): void;
  openExternalUrl(url: string): void;
}

// Telegram implementation: uses Telegram.WebApp.openInvoice, Telegram.WebApp.shareToStory
// PWA implementation: uses Stripe.js, Web Push API, navigator.share
```

**State management (Zustand):**

```typescript
// packages/shared/stores/gameStore.ts  — owned by Agent 2
interface GameStore {
  tableState: TableState | null;
  myHoleCards: Card[] | null;
  pendingAction: ActionPrompt | null;
  oracleAnalysis: OracleResult | null;
  // actions
  applyServerMessage: (msg: ServerMessage) => void;
  submitAction: (action: PlayerAction) => void;
}
```

**Lazy loading strategy (Mini App bundle budget):**

| Chunk | Contents | Size Budget | Load Trigger |
|---|---|---|---|
| `core` | Lobby, default table, WebSocket client, auth | < 2 MB | Immediate |
| `game-ui` | Table rendering, card animations, timer | < 800 KB | On table join |
| `cosmetics` | Premium skins, sound packs, avatar frames | < 1 MB/skin | On demand from CDN |
| `social` | Replay card generator, share flows, referral UI | < 300 KB | On significant hand |
| `oracle-ui` | Oracle display components | < 100 KB | On Oracle tap |

---

### 4.6 Security Architecture

- **Authentication flow (Telegram):** Client sends `initData` → Server validates HMAC using bot token → Creates/retrieves user session → Returns JWT.
- **Authentication flow (PWA):** Email/password → Argon2id hash comparison → HTTP-only cookie containing session token.
- **WebSocket auth:** Bearer token in HTTP upgrade header; server validates before upgrading.
- **Game state authorisation:** Each WebSocket connection bound to a `(session_token, player_id)` pair. All outbound messages filtered through an authorisation check: hole cards sent only to the `player_id` they belong to.
- **Payment integrity:** Stripe webhooks validated by signature; Telegram Stars webhooks validated by bot token HMAC. Chip credit uses idempotency key = `payment_id`. Two-phase: reserve on initiation, confirm on webhook.
- **No PII in hot logs:** Game logs reference `user_id` (UUID), never email or real name. Sentry error payloads scrub email fields.

---

### 4.7 Observability Architecture

- **Error tracking:** Sentry SDK in both Rust backend and React frontend. Error rate metric emitted to Prometheus on every 5-minute scrape.
- **Metrics:** Prometheus scrapes `/metrics` endpoint (Axum handler). Key metrics: `active_tables_count`, `ws_connections_total`, `action_latency_p99_ms`, `db_write_queue_depth`, `error_rate_5m`.
- **Alerting:** Grafana alert rule: `error_rate_5m > 0.01` for 5 minutes → Telegram bot message to admin.
- **Deployment pipeline:** GitHub Actions → automated tests (Agent 5 suite) → staging deploy → canary at 1% traffic → full rollout. Rollback: `git revert` + redeploy previous tag. Deploy window: 02:00–04:00 CET.
- **SQLite monitoring:** WAL file size monitored; checkpoint triggered when > 100 MB; alert if checkpoint duration > 30 seconds.

---

## 5. Architecture Decision Records (ADRs)

### ADR-001 — React/Vite SPA over Rust/Leptos WASM

**Status:** Accepted

**Context:** Two frontend options were evaluated: Rust compiled to WebAssembly (Leptos) and React/TypeScript (Vite). The initial founding document favoured Leptos; the grill session revised this.

**Decision:** Use React 19 + Vite 8 + TypeScript 6 for both platform builds.

**ASRs addressed:** ASR-PERF-002 (bundle size), ASR-MOD-001 (agent parallelism)

**Alternatives considered:**
1. *Leptos/WASM:* Smaller bundle for game logic; 60fps rendering via Canvas. Rejected because: Leptos ecosystem is immature; AI agents (Claude, DeepSeek) produce significantly better React code; debugging WASM is harder; shadcn/ui and Tailwind have no Leptos equivalents.
2. *Next.js:* SSR capabilities; large ecosystem. Rejected because: SSR adds complexity for a WebSocket-heavy realtime app; no benefit over Vite SPA for our use case.

**Consequences (positive):** Shared `@stackbluff/shared` package possible; Agent 2 can use shadcn/ui and Tailwind; faster initial development.

**Consequences (negative):** Slightly larger initial bundle than WASM; mitigated by Vite 8 Rolldown tree-shaking and lazy loading strategy.

---

### ADR-002 — SQLite (WAL) over PostgreSQL for Months 1–6

**Status:** Accepted

**Context:** Standard wisdom favours PostgreSQL for production. However, the scale target for Months 1–6 is ≤ 10 000 DAU. PostgreSQL requires a managed service (Supabase free tier has a 500 MB limit and cold-starts) or a separate VPS.

**Decision:** Use SQLite with WAL mode, single-writer serialisation via `tokio::sync::mpsc`. Migrate to Turso (SQLite-compatible distributed) or PostgreSQL at sustained > 10 000 DAU.

**ASRs addressed:** ASR-PERF-003 (write throughput), ASR-SCALE-001 (cost), ASR-COMP-001 (EU data residency)

**Alternatives considered:**
1. *PostgreSQL on same VPS:* Higher memory overhead; shared resource with Rust process. Rejected for Months 1–6.
2. *Supabase PostgreSQL (free tier):* 500 MB limit, cold-starts, external dependency. Rejected for primary data store.
3. *Turso immediately:* RC pricing, additional complexity. Deferred — adopt at 10K DAU threshold.

**Consequences (positive):** Zero external database dependency; all data on EU Hetzner VPS; single-process simplicity; excellent read performance.

**Consequences (negative):** Single-writer constraint requires careful channel design; no native connection pooling; migration to PostgreSQL at 10K DAU requires a migration sprint (estimated 3 days). Migration runbook is TBD-005.

---

### ADR-003 — Actor-per-Table Model with Tokio Tasks

**Status:** Accepted

**Context:** The game server must handle 500–5 000 concurrent poker tables. Each table has independent game state and a timer. Failure in one table must not propagate.

**Decision:** Each poker table is a spawned `tokio::spawn` task. The `TableRegistry` holds a `HashMap<TableId, JoinHandle + mpsc::Sender>`. Tables communicate with the main server via channels, never via shared mutable state.

**ASRs addressed:** ASR-PERF-001 (latency), ASR-REL-001 (fault isolation)

**Alternatives considered:**
1. *Shared mutable state with `Arc<Mutex<TableState>>`:* Simpler to implement; rejected because Mutex contention under 1 000+ concurrent tables would violate ASR-PERF-001.
2. *Separate OS processes per table:* True isolation; rejected because spawn overhead and IPC latency are unacceptable for 5 000+ tables.

**Consequences (positive):** True fault isolation; no contention; natural backpressure via channel buffer limits; easy to reason about in code.

**Consequences (negative):** Message-passing debugging is harder than shared state; requires careful channel design for broadcast (player ↔ table ↔ bot).

---

### ADR-004 — Single Modular Monolith over Microservices

**Status:** Accepted

**Context:** 5 AI agents working in parallel could suggest microservices as a natural parallelism boundary. However, at 0–10 000 DAU the operational overhead of microservices (service mesh, inter-service latency, distributed tracing) exceeds the benefits.

**Decision:** Single Rust binary (modular monolith) with strict trait-boundary isolation between modules. Module boundaries correspond 1:1 with agent ownership. Extract to microservices only if a specific module hits an independent scaling bottleneck.

**ASRs addressed:** ASR-MOD-001 (agent parallelism), ASR-SCALE-001 (cost), ASR-PERF-001 (latency)

**Alternatives considered:**
1. *Microservices from Day 1:* Natural per-agent deployment independence. Rejected: network overhead between services; distributed transaction complexity for chip credits; operational burden too high for solo founder.
2. *Serverless functions:* Zero idle cost; rejected because WebSocket connections require persistent processes.

**Consequences (positive):** Single deployment; in-process function calls (zero latency between modules); simple operational model.

**Consequences (negative):** All modules must be deployed together; a bug in the viral module could theoretically affect game engine (mitigated by Rust's ownership model and Agent 5's QA boundary).

---

### ADR-005 — Heuristic Oracle over LLM API

**Status:** Accepted (reviewed at Month 2)

**Context:** The Oracle (AI Coach) could use an LLM API (e.g., Claude Haiku at < 0.0001€/hand) or a heuristic template engine. At launch scale (< 5 000 DAU) either is viable on cost. However, LLM API introduces latency variability, external dependency, and rate limit risk.

**Decision:** Launch with heuristic engine (50 templates). Revisit at Month 2 once real hand data informs template coverage gaps and daily hand volume is known (see TBD-001).

**ASRs addressed:** ASR-PERF-001 (Oracle response time ≤ 2s), ASR-SCALE-001 (cost at 300K DAU)

**Alternatives considered:**
1. *Claude Haiku API from Day 1:* Richer coaching; tighter integration with Anthropic ecosystem. Rejected for launch: external API dependency, potential cold-start latency, cost uncertainty at scale.
2. *Rule-based hand scorer (no templates):* Cheaper; rejected because output would be too terse to drive loyalty.

**Consequences (positive):** Deterministic response time; zero external dependency; zero API cost.

**Consequences (negative):** Limited coaching depth at launch; templates require curation; Month 2 decision may flip to LLM (TBD-001).

---

### ADR-006 — Biome over ESLint + Prettier

**Status:** Accepted

**Context:** Frontend tooling requires linting and formatting. Traditional stack is ESLint + Prettier (two tools, slow, config-heavy).

**Decision:** Use Biome 2.4.x as the single tool for linting, formatting, and CSS/HTML checks.

**ASRs addressed:** ASR-MOD-001 (agent parallelism — consistent formatting prevents merge conflicts from whitespace diffs)

**Consequences (positive):** 10× faster than ESLint; single config file (`biome.json`); migration tool available for existing configs; prevents formatting-driven merge conflicts.

**Consequences (negative):** Some ESLint rules not yet ported to Biome; Agent 2 must verify coverage gap before removing ESLint entirely.

---

## 6. API & Interface Contracts

### 6.1 REST API (OpenAPI 3.1 — authoritative spec at `docs/api/openapi.yaml`)

Key design principles:
- All endpoints require authentication except `POST /auth/register`, `POST /auth/login`, `POST /auth/telegram`.
- Error responses: `{ "error": { "code": "string", "message": "string" } }` — never expose stack traces.
- Chip amounts are always integers (no floating point to avoid rounding).
- Timestamps are ISO 8601 UTC strings.

### 6.2 WebSocket Protocol (AsyncAPI 3.0 — authoritative spec at `docs/api/asyncapi.yaml`)

Key design principles:
- Connection ID tied to session token; no unauthenticated connections persisted.
- All messages are JSON `{ "type": "...", "payload": {...} }`.
- Server sends full `table.state` snapshot on connection to a table (prevents stale state on reconnect).
- Timer messages include both `server_timestamp` and `remaining_ms` so client can compensate for network delay.

### 6.3 Database Migration Strategy (SeaORM Migrations)

- Migrations live in `migration/src/` (owned by Agent 1).
- Each migration is additive (no destructive column drops until Month 3 cleanup).
- Migration IDs are sequential integers (`m20260601_000001_create_users`, etc.).
- Agent 5 runs `cargo run --bin migration -- up` as part of every deploy verification.

---

## 7. Cross-Cutting Concerns

### 7.1 Deployment

- **Canary strategy:** GitHub Actions deploys to staging on every merged PR. Production deploy = canary at 1% traffic (Nginx weighted upstream), automated smoke tests, then 100% rollout. Deploy window: 02:00–04:00 CET.
- **Rollback:** `git revert <commit>` + tag previous release + redeploy. Mean time to rollback: < 5 minutes.
- **Static assets:** React SPA bundle deployed to Cloudflare CDN (Pages or R2 + CDN). Backend serves only API and WebSocket.

### 7.2 Error Handling

- All Rust errors use `thiserror` for structured error types and `anyhow` for application-level propagation.
- No `unwrap()` or `expect()` in production code paths (Agent 5 enforces via `cargo deny` rule).
- Errors in table actors are caught and logged; the actor restarts with a clean state (panicking table = fold all active players and log incident).
- Frontend errors caught by React error boundaries per route; reported to Sentry with session context.

### 7.3 Configuration

- All configuration via `figment` (Rust); reads from `.env` in development, environment variables in production.
- Secrets (bot token, Stripe key, Sentry DSN) never committed to git; injected via Hetzner environment variables.
- `dotenvy` for local development `.env` loading.

### 7.4 Scalability Path (Month 6+)

| Trigger | Action |
|---|---|
| Sustained > 10 000 DAU | Migrate to Turso (SQLite-compatible, distributed) or PostgreSQL |
| > 2 000 concurrent WebSocket connections on single VPS | Add second Hetzner node; Nginx upstream load balancing; sticky sessions by `table_id` hash |
| > 500 000 DAU | Evaluate extracting high-traffic modules (leaderboard, viral) to separate services |
| Any single module > 80% CPU | Extract that module to a dedicated Hetzner node |

---

## 8. Alternatives Considered (System-Level)

| Alternative | Reason Rejected |
|---|---|
| Node.js + TypeScript backend | 10× lower concurrency per core than Rust; unacceptable for latency target ASR-PERF-001 |
| Go backend | Better than Node; fewer ecosystem libraries for game logic; AI agents produce better Rust |
| Redis for hot game state | Additional infrastructure cost and complexity at < 10K DAU; actor model with in-process state is sufficient |
| Kafka for event stream | Massive operational overhead for one-server deployment; `tokio::sync::mpsc` is sufficient |
| Supabase PostgreSQL as primary DB | Cold-start latency; 500 MB free tier; external dependency for core data |
| React Native for mobile | Extra build target at launch; PWA wrapper (Capacitor) sufficient for Month 3 |

---

## 9. Traceability

| ASR | Design Decision | ADR |
|---|---|---|
| ASR-PERF-001 | Tokio actor-per-table, in-process message passing | ADR-003 |
| ASR-PERF-002 | Lazy-loaded bundle strategy; React + Vite Rolldown | ADR-001 |
| ASR-PERF-003 | SQLite WAL + single-writer mpsc channel | ADR-002 |
| ASR-REL-001 | Tokio task isolation; panic = actor restart, not server crash | ADR-003 |
| ASR-REL-002 | Canary deployment; SQLite WAL checkpointing | ADR-002, §7.1 |
| ASR-SEC-001 | Per-connection authorisation filter; hole cards filtered server-side | §4.6 |
| ASR-SCALE-001 | SQLite to Turso/PG migration path; Rust concurrency density | ADR-002, §7.4 |
| ASR-MOD-001 | Trait-boundary module isolation; per-file agent ownership | §4.3 |
| ASR-COMP-001 | All data on Hetzner EU VPS; no external managed database | ADR-002 |
| ASR-MON-001 | Prometheus + Grafana; Sentry; Telegram alert bot | §4.7 |

---

*End of Document — StackBluff Architecture v0.1*
