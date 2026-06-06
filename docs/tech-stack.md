This document compiles the latest stable dependency versions for **StackBluff** as of June 2026, following our architectural decisions (React/Vite SPA + Rust/Axum/SeaORM).

---

## 🎨 Frontend Dependencies (Monorepo)

All frontend packages are managed via **pnpm workspaces**.

### Core UI Framework & Compiler

| Package | Version | Notes |
| :--- | :--- | :--- |
| `react` | **19.2.7** (June 1, 2026) | Latest stable; new `<Activity>` API |
| `react-dom` | **19.2.7** | Syncs with React version |
| `typescript` | **6.0** (Mar 23, 2026) | Final JS‑based version; bridge to Go‑native TS 7.0 |

### Build Tooling (Rust‑Powered)

| Package | Version | Notes |
| :--- | :--- | :--- |
| `vite` | **8.0.8+** (Mar 12, 2026) | Now uses Rolldown (Rust‑based bundler) → 10–30x faster builds |
| `@vitejs/plugin-react` | **6.0.2** | Compatible with Vite 8 |
| `vitest` | **4.0.0** | Updated for Vite 8 compatibility |

### State Management & Data Fetching

| Package | Version | Notes |
| :--- | :--- | :--- |
| `zustand` | **5.0.11** | With persist middleware; supports React 18–19 |
| `@tanstack/react-query` | **5.100.14** | Async data fetching |

### UI & Styling

| Package | Version | Notes |
| :--- | :--- | :--- |
| `shadcn/ui` | **4.10.0** (June 1, 2026) | Supports Base UI + Radix UI; RTL layouts |
| `tailwindcss` | **4.3.0** (May 8, 2026) | CSS‑first config; new colors; scrollbar utilities |
| `framer-motion` | **12.40.0** | Now called "Motion"; arc animations |

### Code Quality (One Tool to Rule Them All)

| Package | Version | Notes |
| :--- | :--- | :--- |
| `@biomejs/biome` | **2.4.15** (May 22, 2026) | Replaces ESLint + Prettier; CSS/GraphQL/HTML support |

Biome 2.4.x features: embedded CSS/GraphQL formatting, 15 HTML accessibility rules, Vue/Svelte/Astro support.

---

## 🦀 Rust Backend Dependencies

### Project Configuration

| Setting | Value | Notes |
| :--- | :--- | :--- |
| `edition` | **2024** | Latest stable edition |
| `rust-version` | **1.81** | MSRV pinned for stability |

### Async Runtime & Web Framework

| Crate | Version | Notes |
| :--- | :--- | :--- |
| `tokio` | **1.52.3** (May 8, 2026) | LTS until March 2027; fixed mpsc underflow |
| `axum` | **0.8.9** (May 15, 2026) | WebSocket subprotocol selection; MSRV 1.80 |
| `tokio-tungstenite` | **0.29.0** | Updated for performance； MSRV 1.75 |
| `futures` | **0.3.32** | MSRV 1.71 |

### Database & ORM

| Crate | Version | Notes |
| :--- | :--- | :--- |
| `sea-orm` | **2.0.0‑rc.38** (Mar 2026) | Entity‑first workflow； ER diagram generation |
| `sea-orm-migration` | Same as `sea-orm` | For DB migrations |
| `sqlx` | **0.9.0** | Compile‑time checked queries (SeaORM dependency) |
| `sqlite` (binary) | **3.54+** | Embedded via `libsqlite3-sys` |

### Serialisation & Error Handling

| Crate | Version | Notes |
| :--- | :--- | :--- |
| `serde` | **1.0.228** | Framework for serialising Rust data structures |
| `serde_json` | **1.0.150** | JSON support |
| `thiserror` | **2.0.18** | Derive macro for custom error types |
| `anyhow` | **1.0.102** | Flexible error type for applications |
| `derive_more` | **2.1.1** | Adds convenient derives (From, Display, etc.) |

### Security & Cryptography

| Crate | Version | Notes |
| :--- | :--- | :--- |
| `argon2` | **0.6.0‑rc.8** (Mar 2026) | Pure Rust Argon2 implementation |
| `jsonwebtoken` | **10.3.0** (Jan 27, 2026) | JWT library; **critical security fix** – CVE‑2026‑25537 fixed |
| `uuid` | **1.23.0** (Apr 2026) | UUID generation (v4, v7) |

### Logging & Telemetry

| Crate | Version | Notes |
| :--- | :--- | :--- |
| `tracing` | **0.1.44** (Jan 2026) | Structured diagnostics framework |
| `tracing-subscriber` | **0.3.23** (Mar 2026) | With `env-filter` feature; ANSI sanitisation fixed |

### Configuration & Utilities

| Crate | Version | Notes |
| :--- | :--- | :--- |
| `figment` | **0.10.19** (May 2026) | Flexible configuration from multiple sources |
| `dotenvy` | **0.15.7** | `.env` file loader (maintained fork) |
| `chrono` | **0.4.45** (Feb 2026) | Date/time handling |
| `regex` | **1.12.3** (Feb 2026) | Regular expressions |
| `once_cell` | **1.21.4** (Mar 2026) | Lazy initialisation |

> **Note:** `lazy_static` (1.5.0) is available, but consider using `std::sync::LazyLock` (Rust 1.80+) instead.

### Randomness & Game State

| Crate | Version | Notes |
| :--- | :--- | :--- |
| `rand` | **0.10.0** (Feb 2026) | RNG foundation; MSRV 1.60+ |
| `slotmap` | **1.1.1** (Jan 2026) | Persistent unique keys; use `SlotMap` or `DenseSlotMap` |

### Async Utilities

| Crate | Version | Notes |
| :--- | :--- | :--- |
| `async-trait` | **0.1.89** | Async functions in traits; less needed with modern Rust |
| `strum` | **0.28.0** | Enum utilities (Display, EnumString, etc.) |

---

## 🧪 Development & Testing Tools

| Tool | Version | Notes |
| :--- | :--- | :--- |
| `cargo-nextest` | **0.9.132+** (May 2026) | Next‑gen test runner; faster than `cargo test` |
| `cargo-deny` | **0.19.0** (Jan 2026) | Dependency linting (licenses, advisories) |
| `cargo-vet` | Latest | Optional: supply‑chain security verification |
| `mockall` | **0.14.0** (Mar 2026) | Mocking library for unit tests |

---

## 📦 Version Summary Table

| Category | Key Package | Latest Version |
| :--- | :--- | :--- |
| **Frontend** | React | 19.2.7 |
| | TypeScript | 6.0 |
| | Vite | 8.0.8+ |
| | shadcn/ui | 4.10.0 |
| | Tailwind CSS | 4.3.0 |
| | Biome | 2.4.15 |
| **Backend** | Rust (edition) | 2024 |
| | Tokio | 1.52.3 |
| | Axum | 0.8.9 |
| | SeaORM | 2.0.0‑rc.38 |
| | Serde | 1.0.228 |
| | Thiserror | 2.0.18 |
| | Argon2 | 0.6.0‑rc.8 |
| | JSON Webtoken | 10.3.0 |
| | Tracing | 0.1.44 |
| **Testing** | cargo-nextest | 0.9.132+ |
| | cargo-deny | 0.19.0 |

---

## 🚀 Upgrade & Compatibility Notes

1. **Rust MSRV:** Pinned to **1.81** in `rust-toolchain.toml` to ensure compatibility with Axum 0.8.9.
2. **TypeScript 7.0** (Go‑native) is expected soon – watch the TS blog.
3. **SeaORM 2.0** is in RC; track official release notes for final changes.
4. **Biome 2.x** can migrate your existing ESLint/Prettier configs via the built‑in migration tool.
5. **Tailwind CSS v4** uses a CSS‑first config (`@theme` in CSS), not `tailwind.config.ts`.
6. **CVE‑2026‑25537 (jsonwebtoken):** The vulnerability was fixed in **10.3.0**. Ensure you update to at least this version.
7. **tracing-subscriber 0.3.23** fixes an ANSI escape injection vulnerability (RUSTSEC‑2025‑0055).

This document serves as the single source of truth for all dependency versions. Before building, run `cargo deny check advisories` and `pnpm audit` to catch any newly disclosed issues.
