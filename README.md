<p align="center">
  <strong>A free‑to‑play, multi‑platform (Telegram Mini App + PWA) social poker platform</strong><br/>
  with a <strong>sub‑10ms Rust/WebSocket engine</strong>, built end‑to‑end by <strong>5 parallel AI agents</strong> with zero merge conflicts. Ships real poker, clubs, tournaments, an AI coach ("The Oracle"), and a card‑compositor toolchain — all play‑money, GDPR‑compliant, on a €100 bootstrap budget.
</p>

<div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; align-items: center;">
  <img src="https://img.shields.io/badge/CI-Build%20%26%20Verify-brightgreen?style=flat-square&logo=githubactions" alt="CI">
  <img src="https://img.shields.io/badge/Rust-1.94%20%7C%202024-000000?style=flat-square&logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/Axum-0.8.9-000000?style=flat-square&logo=rust" alt="Axum">
  <img src="https://img.shields.io/badge/React-19.2.7-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Vite-8.0.8-646CFF?style=flat-square&logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/TypeScript-6.0-000000?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-4.3.1-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind">
  <img src="https://img.shields.io/badge/Biome-2.4.15-F7DF1E?style=flat-square&logo=biome" alt="Biome">
  <img src="https://img.shields.io/badge/pnpm-10.8.1-F7044E?style=flat-square&logo=pnpm" alt="pnpm">
  <img src="https://img.shields.io/badge/SQLite-WAL%20%7C%20SeaORM%202.0-003B57?style=flat-square&logo=sqlite" alt="SQLite">
  <img src="https://img.shields.io/badge/License-Proprietary%20%28launch%29-lightgrey?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/Arch-Monorepo%20%2B%20Modular%20Rust%20Monolith-orange?style=flat-square" alt="Arch">
  <img src="https://img.shields.io/badge/Built%20by-5%20AI%20Agents-blueviolet?style=flat-square" alt="Agents">
</div>

---

## What & Why

StackBluff is a free-to-play social poker platform targeting France, then Europe, then the world, on a near-zero €100 bootstrap budget. It runs natively as a **Telegram Mini App** (`/poker` in any group → table in 10s) and as a **Progressive Web App**, backed by a Rust Axum server that processes game actions with **p99 ≤ 10ms latency** at 1,000 concurrent tables.

The differentiators are performance and virality: every hand produces a shareable replay card, an AI Coach ("The Oracle") gives heuristic coaching at zero LLM cost, and a club + seasonal-ranking system turns friend groups into recurring poker clubs. There is **no real-money play, no pay-to-win** — monetisation is purely cosmetic (Season Pass, chip bundles, avatar items).

**Key flows:** Telegram group `/poker` summoning → instant game → shareable replay card → referral attribution. Daily missions, 7-day streaks, club leaderboards, seasonal ranking (Brick → Legend), AI Coach post-hand analysis.

This repository is the **primary product** of a solo founder + 5 AI agents working in parallel with a strict file-ownership contract that guarantees zero merge conflicts.

---

## Tech Stack at a Glance

### Backend — Rust 1.94 | Edition 2024 | Axum 0.8.9 | Tokio 1.52.3
A **modular monolith** (single binary, clean per-module boundaries) with a 21-crate workspace:

| Layer | Crate(s) | Responsibility |
|---|---|---|
| **Web server** | `sb-server`, `sb-rest-router` | Axum HTTP/WebSocket upgrade, REST API, Telegram Bot webhook, static serving |
| **Game engine** | `sb-game-engine` | Hand evaluator, deck, game state machine, analytics (bench-tested) |
| **Table actor** | `sb-table-registry` | Per-table Tokio tasks with mpsc channels — fault isolation |
| **WebSocket** | `sb-ws-handler`, `sb-ws-messages` | Session binding, message dispatch, auth on upgrade |
| **Auth** | `sb-auth` | JWT, Telegram `initData` HMAC, Argon2id |
| **Bots** | `sb-poker-bots`, `sb-bot-handler` | 7 bot profiles, `BotEngine` decision logic, BankrollManager |
| **Anti-cheat** | `sb-anti-cheat` | Chip velocity tracking, collusion detection, IP/fingerprint |
| **Payments** | `sb-payment` | Stripe + Telegram Stars, two-phase commit, idempotency keys |
| **Clubs & Tournaments** | `sb-club`, `sb-tournament` | Club CRUD, leaderboards, MTT/Sit&Go scheduling |
| **Viral / Content** | `sb-viral`, `sb-oracle` | Replay card generation, referral links, heuristic coaching |
| **Infrastructure** | `sb-db-entities` (SeaORM 2.0), `sb-db-repos`, `sb-notification`, `sb-mission`, `sb-contracts` | Entity layer, repos, platform-agnostic notifications, missions |
| **Migrations** | `migration/` | SeaORM migrations (EU Hetzner VPS target) |

**Data:** SQLite (WAL mode) with single-writer serialisation via `tokio::sync::mpsc`. Cloudflare R2 for cold archival of hand histories >30 days. Sentry + Prometheus/Grafana for observability. All data on EU Hetzner (GDPR/CNIL compliant from day one).

### Frontend — React 19.2.7 | Vite 8 | TypeScript 6 | Tailwind 4.3
A **pnpm workspace** monorepo with shared packages:

| App | Stack | Notes |
|---|---|---|
| **PWA** (`apps/pwa`) | React 19, TanStack Router + Query, Zustand 5, Radix UI, Lingui i18n, @sentry/browser, Stripe.js | Service worker, Web Push, full game + lobby + clubs + shop + leaderboard |
| **Telegram Mini App** (`apps/mini-app`) | React 19, Vite 8, `telegram-web-app` | No router; modal/panel stack; Telegram.WebApp API integration |
| **Shared** (`packages/shared`) | Shared game logic, Zustand stores, UI components, PlatformAPI abstraction | One codebase, two platform builds |

**Tooling:** Biome 2.4 (lint + format, replaces ESLint + Prettier), TypeScript 6, Vitest 4 (unit + e2e via Playwright config), Vite 8 with Rolldown bundler. Bundle budget: core ≤ 2 MB.

### Tooling — `tools/`
- **`sb-cards`** — Rust + React card-compositor renderer for shareable replay cards and universe assets (meme-arcana, tintin).
- **`sbdc`** — A Clippy/Nextest-driven development toolkit with CLI, DTO, service, and entity sub-crates.

---

## Repository Layout

```
stackbluff/
├── backend/                    # Rust workspace (21 crates + migration)
│   ├── crates/
│   │   ├── sb-server/          # Axum entrypoint, WebSocket, REST, bot webhook
│   │   ├── sb-game-engine/     # Hand evaluator, game state, benches
│   │   ├── sb-table-registry/  # Per-table actor model
│   │   ├── sb-poker-bots/      # BotEngine, 7 profiles, BankrollManager
│   │   ├── sb-auth/            # JWT, Telegram initData, Argon2id
│   │   ├── sb-payment/         # Stripe + Telegram Stars
│   │   ├── sb-anti-cheat/      # Chip velocity, collusion flags
│   │   ├── sb-club/            # Clubs, tournaments, leaderboards
│   │   ├── sb-oracle/          # Heuristic coaching engine
│   │   ├── sb-viral/           # Replay cards, referrals
│   │   ├── sb-notification/    # Platform-agnostic notifications
│   │   ├── sb-ws-handler/      # WebSocket protocol
│   │   ├── sb-ws-messages/     # Typed WS message contracts
│   │   ├── sb-rest-router/     # REST API routes
│   │   ├── sb-contracts/       # Shared trait contracts (zero-conflict boundary)
│   │   ├── sb-db-entities/     # SeaORM entities
│   │   ├── sb-db-repos/        # Repository pattern
│   │   ├── sb-shared-types/    # Shared Rust types
│   │   └── migration/          # DB migrations
│   └── Cargo.lock / deny.toml / cargo-deny
├── frontend/                   # pnpm workspace
│   ├── apps/
│   │   ├── pwa/                # Full PWA (React 19, TanStack, Zustand)
│   │   └── mini-app/           # Telegram Mini App
│   ├── packages/shared/        # Shared game logic, stores, PlatformAPI
│   ├── pnpm-workspace.yaml
│   ├── biome.json              # Lint + format config
│   └── pnpm-lock.yaml
├── tools/
│   ├── sb-cards/               # Rust + React card compositor
│   └── sbdc/                   # Dev toolkit (CLI, DTO, service, entity)
├── docs/                       # Product + architecture specs
│   ├── spec/                   # Vision (L0), SRS (L1), Architecture (L3), Verification (L4)
│   ├── brainstorm/
│   └── marketing/
├── index.html                  # Card-compositor renderer entry
├── package.json                # Root: card-compositor-renderer (Puppeteer)
├── tsconfig.json
├── justfile
├── wr.sh                       # Patch + cargo check + nextest + commit script
└── dump.txt / dump-f.txt       # Debug dumps (gitignored artifacts)
```

---

## Key Architectural Decisions

- **ADR-001: React/Vite SPA over Rust/Leptos WASM** — Richer ecosystem, shadcn/ui, faster AI-assisted dev. (Rust stays on the server where performance matters.)
- **ADR-002: SQLite (WAL) over PostgreSQL (Months 1–6)** — Zero ops, single-writer via mpsc channel, <2MB binary, EU-only residency. Migrate to Turso/PostgreSQL at >10K DAU.
- **ADR-003: Actor-per-Table (Tokio tasks)** — Each poker table is an isolated `tokio::spawn`. 5,000+ concurrent tables with zero shared mutable state between them. Fault in Table 3 never affects Table 4.
- **ADR-004: Single modular monolith over microservices** — In-process calls = zero latency between modules; module boundaries map 1:1 to agent ownership. Extract services only when a module independently scales.
- **ADR-005: Heuristic Oracle over LLM API at launch** — 50 hand-analysis templates, deterministic <2s p99, zero API cost. Revisits LLM at Month 2.
- **ADR-006: Biome over ESLint + Prettier** — 10× faster, single config, prevents formatting merge conflicts.

Full ADRs: `docs/spec/stackbluff-architecture.md`

---

## AI-Parallel Development Model

The entire codebase is built by **5 AI agents with strict file ownership** — every source file and every DB migration belongs to exactly one agent. Cross-module communication happens exclusively through typed trait contracts in `sb-contracts`. This guarantees **zero merge conflicts by design**:

| Agent | Backend Ownership | Frontend Ownership |
|---|---|---|
| **Agent 1** (Architect) | `game-engine`, `table-registry`, `ws-handler`, `auth`, `rest-router`, `club`, `oracle`, `mission` | — |
| **Agent 2** (Frontend) | — | `apps/pwa/`, `apps/mini-app/`, `packages/shared/components/`, `packages/shared/stores/` |
| **Agent 3** (Platform) | `bot-handler`, `payment`, `notification` | `packages/shared/platform/` |
| **Agent 4** (Growth) | `viral` | `apps/landing/`, `packages/shared/analytics/` |
| **Agent 5** (QA/Ops) | `anti-cheat`, `scripts/`, `tests/` | `packages/shared/test-utils/` |

Full model: `docs/spec/stackbluff-architecture.md#43-agent-ownership--zero-merge-conflict-design`

---

## Development

**Prerequisites:** Rust 1.94+ (edition 2024), pnpm 10.8.1+, Node 20+.

```bash
# Clone
git clone git@github.com:elcoosp/stackbluff.git
cd stackbluff

# Backend (Rust)
cd backend
cargo check --workspace          # or: cargo nextest run --workspace

# Frontend (pnpm workspace)
cd ../frontend
pnpm install
pnpm dev:pwa                     # dev PWA on :5173
pnpm dev:mini                    # dev Telegram Mini App on :5174
pnpm build                       # build all apps + shared
pnpm lint:fix                    # Biome format + lint

# Card compositor tool
cd ../tools/sb-cards/card-compositor-renderer
pnpm dev
```

**Patch script (`wr.sh`):** Automated workflow that patches shared `is_bot` fields across Rust structs, runs `cargo check`, runs `cargo-nextest`, and commits on green.

---

## Testing

- **Rust unit/integration:** `cargo nextest run --workspace` (fastest, parallel by default)
- **Rust mocks:** `mockall 0.14.0` on trait boundaries
- **Frontend unit:** `vitest` (Vite-native, same config as build)
- **Frontend component:** `@testing-library/react`
- **E2E:** `vitest --config e2e/vitest.config.e2e.ts` (Sit&Go + MTT flows against a live test DB)
- **Security:** `cargo deny check advisories` (license + advisory gate, `deny.toml` configured)
- **Load testing:** k6 script targeting 1,000 concurrent tables, p99 ≤ 10ms (`docs/spec/stackbluff-verification.md`)

---

## Documentation

| Doc | Layer | Description |
|---|---|---|
| `docs/spec/stackbluff-vision.md` | L0 | Product vision, target users, OKRs, strategic constraints |
| `docs/spec/stackbluff-srs.md` | L1 | Full SRS — functional + non-functional requirements |
| `docs/spec/stackbluff-brs.md` | L0 | Business Requirements Specification |
| `docs/spec/stackbluff-architecture.md` | L3 | Architecture spec, C4 diagrams, ADRs, agent ownership |
| `docs/spec/stackbluff-verification.md` | L4 | BDD scenarios, test plan, NFR verification, RTM |
| `docs/spec/mtt-sg.md` | L2 | MTT & Sit&Go tournament specs |
| `docs/spec/mtt-sg-ui.md` | L2 | Tournament UI/UX spec |
| `docs/tech-stack.md` | — | Pinned dependency versions |
| `docs/issues.md` | — | Open issues & decisions |
| `docs/grill.md` | — | Grill session notes |
| `docs/brainstorm/` | — | Analytics, UI/UX, marketing, tracking |

---

## License

Proprietary — built for launch. All rights reserved by the founder. The play-money model means no gambling regulatory barriers (ANJ exemption for free-to-play), GDPR/CNIL compliant from day one.

---

<p align="center">
  <em>Made by one founder + 5 AI agents. Built for speed, built for scale, built to ship.</em>
</p>
