You've survived the grilling. Here's the **complete summary** of every decision we clarified across 20+ questions.

---

## Final Summary: StackBluff Architecture & Strategy Decisions

### 1. Frontend Stack
- **React + Vite SPA** (not Leptos/WASM)
- Shared package (`@stackbluff/shared`) with game logic, UI components, Zustand stores, platform abstraction
- Telegram Mini App: no router, modal/panel stack, uses `Telegram.WebApp`
- PWA: full React Router, service worker, Web Push

### 2. Backend & Database
- **Rust + Axum + Tokio + WebSockets** (unchanged)
- **SQLite** (not PostgreSQL) with WAL mode, write‑serialization via `tokio::sync::mpsc` channel
- Recovery: SQLite checkpointing (no Redis initially)
- Hand history retention: 30 days, then cold storage (Cloudflare R2)
- Migration path: at ~10K DAU, move to Turso (SQLite‑compatible distributed) or PostgreSQL for horizontal scaling

### 3. Authentication (PWA)
- **Email + password** (bcrypt, HTTP‑only cookies) as primary
- Telegram OAuth as secondary option
- JWT or session cookies

### 4. AI Coach ("The Oracle")
- **Heuristic engine + pre‑written sentence templates** (no LLM API)
- MVP: 50 templates (preflop, postflop, river, compliments)
- Add 50 more in Month 3 based on real hand data

### 5. Subscription & Monetisation
- **Season Pass**: one‑time payment per season (5.99€), not recurring
- **Club Pro**: full subscription history table (not just expiry timestamp)
- **Payments**: Telegram Stars (Mini App) + Stripe (PWA) + PayPal optionally

### 6. Anti‑Cheat & Collusion
- **Automated real‑time blocking from day one** (rule‑based scoring)
- **1v1 mode**: net transfer cap per pair (e.g., 5,000 chips/day) with unlimited games – preserves viral loops while preventing chip farming
- Collusion detection: same IP/device fingerprint, chip transfer velocity

### 7. Leaderboards
- **Materialised views refreshed every 5 minutes** (global leaderboards)
- Client‑side optimistic rank updates for instant feedback
- Club leaderboards with >500 members: **division sharding** (max 500 rows per division)

### 8. Game Abandonment & Timers (Industry Standard)
- Decision timer: **30 seconds**
- **Time bank**: additional 30 seconds per session, refilled by playing hands
- Disconnect: auto‑fold, sat out, 60‑90 second reconnect window
- Tournaments: blinded out until elimination
- **Kick option** (2+ players agree) for inactive cash game players

### 9. Deployment & CI/CD
- **Three‑stage pipeline**: automated checks (Agent 5) → staging deploy → canary (1% → 100%)
- Deploy during low traffic (02:00–04:00 CET)
- Rollback: `git revert` + redeploy previous tag

### 10. Telemetry & Error Tracking
- **Sentry** (free tier) for frontend/backend errors
- **Prometheus + Grafana** self‑hosted on Hetzner for metrics
- Alerts to Telegram bot on error rate >1% for 5 minutes

### 11. Viral Growth Mechanics (All of Them)
You requested **all** of the following (no prioritisation):

| Tactic | Implementation |
|--------|----------------|
| **Double‑sided referral** | Both referrer & new user get bonus chips (tiered, streak‑based) |
| **VIP inviter status** | "Founding Member" badge at 10 invites, permanent |
| **Epic hand replays** | Auto‑generated share card after Royal Flush, bad beat, etc. |
| **Social flex badges** | Streak count, leaderboard top‑performer shareable |
| **Daily Hand Puzzle** (Hamster Kombat style) | Solve & share to get answer → drives daily engagement |
| **Engineered scarcity** | Invite‑only rooms/clubs, temporary FOMO events |
| **Micro‑influencer program** | Engage small Telegram poker groups with exclusive skins |
| **Adsgram** (Telegram Mini App ads) | Paid acquisition using Telegram Stars |
| **Launch week triple chips** | For first 1,000 users, triple referral bonus |
| **Founder badges** | First 100 clubs get permanent founder badge + unique skin |

### 12. Asset Loading (Telegram 6MB Limit)
- **Core bundle <2MB** (lobby, default table, WebSocket logic)
- **Lazy‑load** skins, sounds, premium assets via CDN + IndexedDB cache

### 13. Push Notifications
- **Dual implementation**: Telegram Bot API for Mini App, Web Push for PWA
- Shared `PlatformAPI` interface

### 14. Launch Day Viral Guarantee
- Double‑chips for 7 days referral program (first 1,000 users)
- Founder badges for first 100 clubs
- Daily Hand Puzzle from Day 1

---

## Final Verdict

Your architecture is now **hardened, cost‑conscious, and virality‑optimised**. The stack is:

- **Frontend**: React + Vite (shared package, two platform builds)
- **Backend**: Rust + Axum + SQLite (with write serialisation)
- **AI Coach**: Heuristic + 50 templates (zero LLM cost)
- **Viral mechanics**: All of the above, measured and iterated
- **Budget**: 90€ ops first 3 months, then revenue reinvested

**You're ready to build.** The chips are on the table. Now go execute.

Would you like me to output the full revised roadmap as a new document, or is this summary sufficient?
