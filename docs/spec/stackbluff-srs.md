# StackBluff — Software Requirements Specification

| Field | Value |
|-------|-------|
| Project | StackBluff |
| Document | L2 — Software Requirements Specification (SRS) |
| Version | 0.1 (Draft) |
| Date | 2026-06-06 |
| Author | Founder, assisted by AI |
| Status | Draft — Pending Review |
| Traces to | stackbluff-brs.md v0.1, stackbluff-vision.md v0.1 |

---

## 1. Introduction & Scope

### 1.1 Purpose

This SRS defines all functional and non-functional requirements for the StackBluff platform. It is the authoritative specification for the five AI build agents and serves as the contract between what the business needs (BRS) and what the system must do. Every requirement herein is traceable to a stakeholder need (SN-xxx) or business rule (BR-xxx) from the BRS.

### 1.2 System Boundaries

**StackBluff system** consists of:
- Rust/Axum backend (game engine, WebSocket server, REST API, bot handler)
- React/Vite SPA (shared frontend, two platform builds: PWA + Telegram Mini App)
- SQLite database (WAL mode, single-writer via `tokio::sync::mpsc` channel)
- Cloudflare R2 integration (cold storage for hand histories > 30 days)

**Outside system boundary:** Telegram infrastructure, Stripe, Cloudflare CDN, Hetzner compute, Sentry, Prometheus/Grafana.

### 1.3 ID Scheme

| Prefix | Document | Example |
|---|---|---|
| REQ-FUNC-xxx | Functional requirements | REQ-FUNC-001 |
| REQ-NFR-PERF-xxx | Performance NFRs | REQ-NFR-PERF-001 |
| REQ-NFR-SEC-xxx | Security NFRs | REQ-NFR-SEC-001 |
| REQ-NFR-REL-xxx | Reliability NFRs | REQ-NFR-REL-001 |
| REQ-NFR-USE-xxx | Usability NFRs | REQ-NFR-USE-001 |
| REQ-NFR-COMP-xxx | Compliance NFRs | REQ-NFR-COMP-001 |
| REQ-INT-xxx | Interface requirements | REQ-INT-001 |
| TBD-xxx | Open uncertainty items | TBD-001 |

Priority: **M** = Must Have, **S** = Should Have, **C** = Could Have, **W** = Won't Have (this version)

---

## 2. System Context & Overview

### 2.1 Actors

| Actor | Description |
|---|---|
| **Player** | Any registered user engaged in gameplay |
| **Club Owner** | A player who has created at least one club |
| **Spectator** | A user observing a table without playing |
| **Telegram Bot** | The StackBluff bot acting within Telegram on behalf of the system |
| **Admin (Founder)** | Operator with backend and monitoring access |

### 2.2 External Systems

| System | Integration Point | Direction |
|---|---|---|
| Telegram Bot API | Game invites, result posts, tournament reminders | Outbound (StackBluff → Telegram) |
| Telegram Mini App API | Player auth (initData), Telegram Stars payment | Inbound |
| Stripe | PWA payment processing webhooks | Inbound (webhook) |
| Cloudflare R2 | Hand history archival (> 30 days) | Outbound |
| Sentry | Error event ingestion | Outbound |
| Cloudflare CDN | Static asset delivery | Outbound |
| Resend | Transactional email (PWA auth) | Outbound |

---

## 3. Functional Requirements

### 3.1 Feature: User Authentication & Registration

**Goal:** Allow players to create accounts and authenticate across both platforms with minimal friction.

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-001 | When a new user opens the Telegram Mini App, the system shall authenticate them automatically using `Telegram.WebApp.initData` and create an account if none exists, without any manual form entry. | M | SN-001, SN-002 | New Telegram user reaches the lobby in ≤ 3 taps from clicking a game invite |
| REQ-FUNC-002 | When a new user opens the PWA, the system shall offer email + password registration and Telegram OAuth as authentication options. | M | SN-002 | User can complete PWA registration in ≤ 2 minutes |
| REQ-FUNC-003 | The system shall assign every new user a globally unique pseudonymous ID and a display name (editable) on account creation. | M | BR-005, GDPR | User ID is never their real name or email by default |
| REQ-FUNC-004 | The system shall maintain a persistent session (HTTP-only cookie or JWT) valid for 30 days before requiring re-authentication. | M | SN-002 | Returning user does not need to re-login within 30 days |
| REQ-FUNC-005 | If a user opens the same account via both Telegram and PWA, the system shall unify their chip balance and profile. | M | SN-004 | Same balance visible whether accessed via Telegram or PWA |

**Error flows:**
- REQ-FUNC-001-E1: If `initData` validation fails, display error and offer fallback email registration.
- REQ-FUNC-002-E1: If email already registered, prompt "sign in instead" — never expose whether an email is registered to an unauthenticated party.

---

### 3.2 Feature: Core Texas Hold'em Game Engine

**Goal:** Provide a correct, fair, and fast Texas Hold'em game loop for 2–9 players.

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-010 | The game engine shall correctly evaluate all 2,598,960 possible 5-card hand combinations and rank them according to standard Texas Hold'em rules. | M | BR-008 | 100% of hand evaluation unit tests pass (including all edge cases: ace-high straight, wheel, same hand different kickers) |
| REQ-FUNC-011 | The system shall use a cryptographically secure pseudo-random number generator (CSPRNG) for all deck shuffles. | M | BR-008 | Shuffle uses OS-level `getrandom`; no deterministic seed observable by client |
| REQ-FUNC-012 | The system shall never transmit a player's hole cards to any other client until the hand reaches showdown. | M | BR-008 | Network capture shows hole card data only in the hand's showdown message |
| REQ-FUNC-013 | Each poker table shall operate as an isolated Tokio async task. The failure of one table task shall not affect other running tables. | M | REQ-NFR-REL-001 | Simulated table panic does not affect other tables in load test |
| REQ-FUNC-014 | The system shall support cash game tables with 2–9 seats and 6 configurable stake levels. | M | BRS §4.1 | All 6 stake levels create valid tables; 9-player tables complete full hand sequences |
| REQ-FUNC-015 | The system shall enforce a 30-second decision timer per player action. | M | BR-010 | Timer starts immediately after the action prompt; auto-fold fires at exactly T+30s if no action received |
| REQ-FUNC-016 | The system shall maintain a time bank of 30 additional seconds per player per session, consumed in 1-second increments when the main timer expires. | M | BR-010 | Time bank depletes correctly; zero bank triggers auto-fold at 0s remaining |
| REQ-FUNC-017 | On player disconnect, the system shall treat the player as "sat out" and auto-fold their hand after the 60-second reconnect window expires. | M | BR-011 | Disconnected player's hand auto-folds at 60s; reconnected player within window resumes normally |
| REQ-FUNC-018 | The system shall support Sit & Go tournaments (6 or 9 player) that auto-start when all seats are filled. | M | SN-008 | 9-player Sit & Go starts within 5 seconds of last seat being filled |
| REQ-FUNC-019 | The system shall support multi-table tournaments (MTT) with 30–500 players, configurable blind schedules, and player elimination. | S | SN-008 | MTT correctly merges tables when < 50% seats occupied; final table plays to one winner |
| REQ-FUNC-020 | Two active players at a cash game table may vote to kick an inactive third player; a majority vote (≥ 2 of remaining active players) triggers removal. | S | BR-011 | Kick vote resolves in ≤ 10 seconds; kicked player receives notification |

**Unwanted behaviours (EARS):**
- REQ-FUNC-010-U: If the hand evaluator returns an undefined result for any input combination, the system shall log a critical error, award the pot to the player with the fewest cards in hand, and flag the hand for manual review.
- REQ-FUNC-015-U: If the timer WebSocket message fails to deliver, the system shall fall back to server-side timer enforcement; the client may be up to 2 seconds behind the server timer but the server timer is authoritative.

---

### 3.3 Feature: Telegram Integration

**Goal:** Enable viral table creation, game invitations, and result broadcasting through Telegram.

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-030 | When a user sends `/poker` in any Telegram group, the bot shall respond within 3 seconds with an inline game card containing a "Join Table" button for up to 9 players. | M | SN-001, BP-001 | Bot responds in ≤ 3s; Join button opens Mini App in Telegram correctly |
| REQ-FUNC-031 | When a user sends `@stackbluffbot challenge @friend`, the bot shall generate a 1v1 heads-up challenge card in the conversation. | S | BP-001 | Challenge card appears within 3s; both parties can accept and start a game |
| REQ-FUNC-032 | After a game session ends, the bot shall post a result summary to the originating group containing winner name, winning hand, and chip amounts. | M | SN-014, BP-001 | Result post appears in group within 5 seconds of final hand completion |
| REQ-FUNC-033 | The result post shall contain an embedded invite link that, when tapped by a non-player, initiates new user registration and drops them into a new game. | M | G-2 (viral) | Invite link correctly attributes the new registration to the referrer |
| REQ-FUNC-034 | The bot shall send a tournament reminder to all registered participants 60 minutes and 10 minutes before tournament start, via Telegram DM. | S | SN-014 | Both reminders sent; deep link in reminder opens tournament lobby directly |
| REQ-FUNC-035 | For clubs with a linked Telegram group, the bot shall post tournament results automatically to that group after tournament completion. | S | SN-014 | Post appears within 10 seconds; includes top 3 placements and winning hand |

---

### 3.4 Feature: Club System

**Goal:** Allow users to create, manage, and compete within branded poker clubs.

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-040 | A player shall be able to create a club in ≤ 3 interactions (name entry, optional logo, confirm). | M | SN-011 | New club created and share link generated in ≤ 3 seconds |
| REQ-FUNC-041 | Each club shall have a persistent leaderboard ranked by weekly XP earned at club tables. | M | SN-013 | Leaderboard refreshes within 5 minutes of any XP-granting event |
| REQ-FUNC-042 | A club leaderboard with > 500 members shall be automatically partitioned into divisions of ≤ 500 members each. | M | BR-014 | Division sharding activates at 501st member; no leaderboard query exceeds 500 rows |
| REQ-FUNC-043 | A club owner shall be able to schedule a club tournament specifying: date/time, blind structure template, maximum players, and buy-in chip amount. | S | SN-012 | Tournament creation flow completes in ≤ 2 minutes; tournament appears in club calendar |
| REQ-FUNC-044 | Members shall receive a Telegram/Web Push notification 60 minutes and 10 minutes before a club tournament they have registered for. | S | SN-014 | Both notifications sent; bot notification used for Mini App users, Web Push for PWA users |
| REQ-FUNC-045 | Club Pro subscribers shall be able to customise club name, banner image, chip design (from 5 presets), and table felt colour (from 8 presets). | C | SN-015 | Customisation changes visible to all club members within 30 seconds |
| REQ-FUNC-046 | A monthly chip trophy shall be automatically awarded to the club member with the highest accumulated XP over the calendar month. | S | BP-002 | Award triggers at 00:00 UTC on the 1st of each month; trophy displayed on winner's profile |

---

### 3.5 Feature: Viral Mechanics

**Goal:** Maximise the organic viral coefficient through shareable artefacts, referral rewards, and engineered FOMO.

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-050 | The system shall automatically generate a shareable Replay Card for every hand where: the winning hand is a straight flush or better, an all-in is called, a player wins a pot ≥ 10× their starting stack in that hand, or a tournament knock-out occurs. | M | BP-004, G-2 | Card generated within 3 seconds of hand completion; card includes result, winning hand, chip amounts, and invite link |
| REQ-FUNC-051 | The Replay Card shall be shareable to Telegram, Twitter/X, and (on mobile) the native share sheet in one tap. | M | SN-005 | Share completes in ≤ 2 taps; invite link in shared card correctly attributed |
| REQ-FUNC-052 | The referral system shall credit both the referrer and the new user with bonus virtual chips upon the new user completing their first 5 hands. | M | BR-015 | Bonus credited within 5 seconds of the 5th hand completion; referrer notified via bot/push |
| REQ-FUNC-053 | For the first 1 000 registered users, the referral bonus shall be triple the standard amount. | M | BR-015 | System tracks cumulative user count; bonus automatically reverts to standard at user #1001 |
| REQ-FUNC-054 | The system shall implement a Daily Hand Puzzle feature: once daily, a hand scenario is presented to users; they submit their action; the correct answer is revealed and shared as a social CTA. | S | Grill §11 | Puzzle delivers 1 new hand per day; "share my answer" generates a social card with result |
| REQ-FUNC-055 | The system shall award a permanent "Founding Member" badge to any user who has successfully referred ≥ 10 new users who each complete their first 5 hands. | C | Grill §11 | Badge appears on profile within 5 minutes of hitting the 10-referral threshold |
| REQ-FUNC-056 | The system shall award a permanent "Founder Club" badge and a unique table skin to the first 100 clubs created. | C | Grill §11 | Badge visible on club profile within 5 minutes of the 100th club creation trigger |

---

### 3.6 Feature: AI Coach — The Oracle

**Goal:** Provide post-hand skill coaching using a heuristic engine with pre-written analysis templates.

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-060 | The Oracle shall deliver a hand analysis within 2 seconds of the player tapping the Oracle button, for any completed hand. | M | SN-006 | P99 Oracle response time ≤ 2000ms under normal load |
| REQ-FUNC-061 | The Oracle shall maintain a library of ≥ 50 hand analysis templates at launch covering: pre-flop raise sizing, c-bet decisions, pot odds calculation, river bluff catching, positional play, and compliment messages. | M | Grill §4 | Template library documented and unit-tested; each template produces grammatically correct output |
| REQ-FUNC-062 | The Oracle template library shall be expanded to ≥ 100 templates by Month 3 based on real hand data. | S | Grill §4 | Month 3 release includes ≥ 50 new templates; expansion documented in a separate config file |
| REQ-FUNC-063 | The Oracle shall display pot odds calculation in the format: "Pot odds were X:Y; your [hand type] needed Z:W odds to be a profitable call." | M | SN-006 | All pot-odds templates produce correct arithmetic; unit tested with known hand scenarios |
| REQ-FUNC-064 | Free users shall receive Oracle analysis for up to 3 hands per session. Season Pass holders shall receive unlimited Oracle access. | S | Business model | Oracle usage counted per session; hard cap enforced at 3 for free users; Season Pass holders bypass cap |

**Explicit non-LLM constraint:** The Oracle is implemented as a heuristic engine with template selection logic based on hand parameters. It shall NOT make API calls to any external LLM service unless this is explicitly approved by the Founder after Month 2 review (see TBD-001).

---

### 3.7 Feature: Seasonal Ranking System (StackBluff League)

**Goal:** Provide a competitive meta-game that drives daily engagement and seasonal sharing spikes.

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-070 | The system shall maintain 8 rank tiers: Brick, Bronze, Silver, Gold, Platinum, Diamond, Maestro, Legend. | M | SN-007 | All 8 tiers exist in the data model; each has a distinct trophy card visual asset |
| REQ-FUNC-071 | A season shall last exactly 8 weeks. At season end, all player ranks shall reset to an algorithmically determined starting rank based on their previous season performance (soft reset). | M | SN-007 | Season timer triggers correctly; soft reset moves returning players to ≥ 1 tier below their final rank |
| REQ-FUNC-072 | Rank changes shall be reflected on the player's profile within 60 seconds of the triggering game completing. | S | SN-007 | Rank update delivered via WebSocket push or next session load; never stale > 60s |
| REQ-FUNC-073 | The system shall generate a shareable Season End Card for each player showing their final rank, best hands, and chip total. | S | G-2 | Season end card generated within 24 hours of season close; share CTA present |

---

### 3.8 Feature: Daily Missions & Streak System

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-080 | Each player shall receive exactly 3 daily missions, refreshed at 00:00 UTC. | M | SN-004, BP-005 | Missions refresh exactly at 00:00 UTC; player sees 3 missions on first session of the day |
| REQ-FUNC-081 | The mission pool at launch shall contain ≥ 30 distinct mission types. | M | BR-RSK-003 | Mission pool documented and seeded in database; no player sees same 3 missions 3 days in a row (probabilistically) |
| REQ-FUNC-082 | Completing all 3 daily missions shall reward the player with a chip bonus. | M | BP-005 | Bonus credited within 5 seconds of 3rd mission completion |
| REQ-FUNC-083 | A 7-day consecutive mission completion streak shall award a "Streak Shield" bonus chip pack (5× the daily mission reward). | M | BP-005 | Streak tracked accurately; 7-day award triggers once; streak counter resets to 0 if a day is missed |

---

### 3.9 Feature: Payment & Subscription Management

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-090 | The system shall process chip bundle purchases via Telegram Stars (Mini App) and Stripe (PWA). | M | Business model | Purchase flow complete; chips credited within 10 seconds of payment confirmation webhook |
| REQ-FUNC-091 | The system shall issue a Season Pass upon confirmed payment, valid for exactly 8 weeks from activation. | M | Business model | Pass active status verified; expiry timestamp is exactly 8 weeks from activation |
| REQ-FUNC-092 | The Club Pro subscription shall maintain a complete subscription history table (not just an expiry timestamp), recording: subscription start, end, renewal, cancellation events. | M | BR-013 | History table contains all events; no events deleted or overwritten |
| REQ-FUNC-093 | Chip credits shall never be applied until payment is confirmed. The system shall use a two-phase commit pattern: reserve credits on payment initiation, confirm on webhook receipt. | M | BR-001, BR-004 | Simulated webhook failure results in zero credits applied; idempotency key prevents double-crediting |
| REQ-FUNC-094 | The system shall support both Stripe and Telegram Stars for all purchaseable products except products exclusive to one platform (e.g., Stars-only bundles). | S | Business model | Checkout flow offers correct payment method based on platform context |

---

### 3.10 Feature: Anti-Cheat & Collusion Detection

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-100 | The system shall enforce a net chip transfer cap between any pair of accounts: net transfer > 5 000 chips/day in the same direction triggers an automatic flag and transfer block. | M | BR-009, Grill §6 | Violation triggers within the same transaction; excess transfers rejected; flag logged |
| REQ-FUNC-101 | The system shall detect and flag accounts sharing the same IP address and device fingerprint playing heads-up against each other repeatedly (≥ 5 heads-up sessions in 24 hours). | M | BR-009 | Flag logged; accounts placed under review; no automatic ban without human review |
| REQ-FUNC-102 | All game state shall be computed server-side. The client shall receive only the information it is authorised to know (hole cards only for the relevant player). | M | BR-008 | Network inspection reveals no opponent hole card data before showdown |
| REQ-FUNC-103 | The system shall apply per-user and per-IP rate limits on all action endpoints (fold, call, raise, chat) via middleware. | M | BR-008 | Automated bot firing 10 actions/second is throttled; legitimate gameplay (< 2 actions/second) unaffected |

---

### 3.11 Feature: Notifications (Dual Implementation)

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-110 | For Mini App users, the system shall deliver notifications (tournament reminders, streak alerts, referral conversions) via Telegram Bot API. | M | BRS §3.4 | Notification delivered within 30 seconds of trigger event |
| REQ-FUNC-111 | For PWA users, the system shall deliver notifications via Web Push (with opt-in consent). | M | BRS §3.4 | Web Push consent requested once after first game; notifications delivered within 30 seconds |
| REQ-FUNC-112 | The system shall maintain a single `PlatformAPI` interface that routes notifications to the correct delivery mechanism based on user's registered platform. | M | Grill §13 | Changing a user's platform flag routes subsequent notifications correctly |

---

### 3.12 Feature: Leaderboards

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-120 | The system shall maintain a global leaderboard ranked by chips won, refreshed via a materialised view on a 5-minute schedule. | M | BR-014 | Materialised view refreshes within ≤ 5 minutes of any qualifying event; query returns in ≤ 200ms |
| REQ-FUNC-121 | The client shall apply optimistic rank updates immediately upon receiving a hand result, before the next materialised view refresh. | S | Grill §7 | UI shows estimated rank within 500ms of hand completion; corrects to server rank on next refresh |

---

### 3.13 Feature: Hand History & Replay

| ID | Requirement | Priority | BRS Trace | Acceptance Criterion |
|---|---|---|---|---|
| REQ-FUNC-130 | The system shall store a complete hand history record (all actions, cards, chip movements) for every hand. | M | BRS §7 | Every hand has a complete, queryable record within 2 seconds of completion |
| REQ-FUNC-131 | Hand histories older than 30 days shall be automatically migrated to Cloudflare R2 cold storage. | M | Grill §2 | Daily archival job runs; hot database contains only ≤ 30 days of history; archived hands retrievable |
| REQ-FUNC-132 | The system shall make the last 100 hands of any player available for replay in the PWA (hot storage window). | S | SN-009 | Player can replay any of their last 100 hands; replay accurately reconstructs the hand sequence |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Fit Criterion | BRS Trace |
|---|---|---|---|
| REQ-NFR-PERF-001 | WebSocket game action latency | Server-to-server round trip ≤ 10ms at p99 under 1 000 concurrent tables | BR-008, BG-007 |
| REQ-NFR-PERF-002 | WebSocket game action latency under peak load | P99 ≤ 50ms under 5 000 concurrent tables on a single Hetzner CAX11 | BG-007 |
| REQ-NFR-PERF-003 | REST API response time | P99 ≤ 200ms for all non-game-state endpoints (lobby, profile, leaderboard) under 1 000 concurrent users | SN-002 |
| REQ-NFR-PERF-004 | Oracle response time | P99 ≤ 2 000ms for hand analysis delivery | SN-006 |
| REQ-NFR-PERF-005 | PWA initial load time | Core bundle ≤ 2 MB; time-to-interactive ≤ 3 seconds on mobile 4G (25 Mbps) | BRS §10 |
| REQ-NFR-PERF-006 | Telegram Mini App initial load | Core bundle ≤ 2 MB; Mini App opens to playable lobby in ≤ 5 seconds | Telegram 6 MB limit |
| REQ-NFR-PERF-007 | Leaderboard query | Global leaderboard query returns in ≤ 200ms; club leaderboard ≤ 100ms | BR-014 |
| REQ-NFR-PERF-008 | Game rendering | Table renders at 60fps on a mid-range smartphone (2022-era hardware, 4GB RAM) with no dropped frames during card animations | Vision §4.4 |
| REQ-NFR-PERF-009 | Database write throughput | SQLite WAL mode handles ≥ 500 writes/second without contention errors under 1 000 concurrent tables | Grill §2 |

### 4.2 Reliability & Availability

| ID | Requirement | Fit Criterion | BRS Trace |
|---|---|---|---|
| REQ-NFR-REL-001 | Service availability | ≥ 99.5% monthly uptime (allows ≤ 3.6 hours downtime/month) | BG-001 |
| REQ-NFR-REL-002 | Table isolation | The crash of any single table actor shall not affect any other table; P(cascade failure) = 0 | REQ-FUNC-013 |
| REQ-NFR-REL-003 | Deployment downtime | Deployments via canary strategy (1% → 100%) shall cause ≤ 30 seconds of elevated error rate (< 5% errors during rollout) | Grill §9 |
| REQ-NFR-REL-004 | Database recovery | SQLite WAL checkpoint completes within 60 seconds of server restart; no hand history loss for hands completed > 2 seconds before crash | Grill §2 |
| REQ-NFR-REL-005 | Error alerting | Sentry error rate > 1% over any 5-minute window triggers an automated Telegram alert to the admin bot | Grill §10 |

### 4.3 Security

| ID | Requirement | Fit Criterion | BRS Trace |
|---|---|---|---|
| REQ-NFR-SEC-001 | Data in transit | All HTTP and WebSocket traffic uses TLS 1.3 minimum; TLS 1.1 and below are rejected | BR-005 |
| REQ-NFR-SEC-002 | Password storage | PWA passwords stored using Argon2id with ≥ 2 iterations, 64 MB memory, 1 thread | Grill §3 |
| REQ-NFR-SEC-003 | JWT security | All JWTs use the CVE-2026-25537-patched `jsonwebtoken` crate ≥ 10.3.0; tokens expire after 30 days | Tech stack |
| REQ-NFR-SEC-004 | Game state integrity | The server never sends hole card data for Player A to Player B's WebSocket connection; verified by automated network inspection tests | BR-008 |
| REQ-NFR-SEC-005 | Rate limiting | Per-user: ≤ 10 game actions/second; per-IP: ≤ 100 requests/minute to auth endpoints | REQ-FUNC-103 |
| REQ-NFR-SEC-006 | Telegram initData validation | Every Mini App session validates `initData` HMAC using the bot token before creating or resuming a session; invalid signatures rejected with HTTP 401 | REQ-FUNC-001 |
| REQ-NFR-SEC-007 | No PII in game logs | Game logs and hand histories shall not contain email addresses, real names, or payment identifiers | BR-005 |
| REQ-NFR-SEC-008 | Payment integrity | Chip credits applied only after Stripe/Stars webhook with valid signature; idempotency keys prevent double-credit | REQ-FUNC-093 |
| REQ-NFR-SEC-009 | Chip economy integrity | The system shall enforce chip balance invariant: `balance_after = balance_before + credits - debits`; any transaction violating this is rejected and logged | BR-001 |

### 4.4 Usability

| ID | Requirement | Fit Criterion | BRS Trace |
|---|---|---|---|
| REQ-NFR-USE-001 | New user onboarding | A new Telegram user shall reach the game lobby in ≤ 3 interactions after clicking a game invite | SN-001, SN-002 |
| REQ-NFR-USE-002 | New user onboarding — PWA | A new PWA user completes registration and reaches the lobby in ≤ 2 minutes | SN-002 |
| REQ-NFR-USE-003 | Club creation | A new club shall be creatable in ≤ 3 interactions | SN-011 |
| REQ-NFR-USE-004 | Tournament scheduling | Scheduling a club tournament shall require ≤ 2 minutes from opening the scheduling flow to confirmation | SN-012 |
| REQ-NFR-USE-005 | Mobile readability | All game UI text shall be readable at 100% zoom on a 375px-wide viewport (iPhone SE equivalent) without horizontal scrolling | BRS §10 |
| REQ-NFR-USE-006 | Dark mode | The UI shall ship in dark mode by default; no light mode required at launch | Vision §4.4 |

### 4.5 Compliance

| ID | Requirement | Fit Criterion | BRS Trace |
|---|---|---|---|
| REQ-NFR-COMP-001 | Cookie consent | A GDPR-compliant cookie consent banner is displayed to all EU users on first visit; analytics/tracking cookies not set before consent | BR-005, GDPR |
| REQ-NFR-COMP-002 | Data deletion | Users can request account and data deletion via a self-service endpoint; deletion completes within 30 days of request | BR-006, GDPR Art. 17 |
| REQ-NFR-COMP-003 | Data residency | All user PII and game data stored exclusively on Hetzner EU-region infrastructure | BR-005 |
| REQ-NFR-COMP-004 | No cash-out path | The system shall contain no endpoint, flow, or mechanism that converts virtual chips to real currency, crypto, or transferable value | BR-001 |
| REQ-NFR-COMP-005 | Privacy Policy & ToS | Published Privacy Policy and Terms of Service accessible from all entry points before any account creation | BR-005 |

---

## 5. External Interface Requirements

### 5.1 WebSocket Game Protocol

| ID | Requirement | Priority |
|---|---|---|
| REQ-INT-001 | The game server shall expose a WebSocket endpoint at `wss://{host}/ws/game`. | M |
| REQ-INT-002 | All WebSocket messages shall be JSON-encoded with a `type` field and a `payload` field. | M |
| REQ-INT-003 | The client shall authenticate the WebSocket connection by sending a `session_token` in the initial HTTP upgrade request (header: `Authorization: Bearer <token>`). | M |
| REQ-INT-004 | The server shall send heartbeat pings every 30 seconds; clients not responding within 10 seconds shall be marked as disconnected. | M |

**Core message types (outbound — server to client):**

| Message Type | Payload Summary |
|---|---|
| `table.state` | Full table state snapshot (seats, stacks, community cards, pot, action position) |
| `hand.dealt` | Player's own hole cards (visible only to recipient) |
| `action.required` | Action prompt: valid actions, amounts, timer start |
| `action.broadcast` | Another player's action (fold/call/raise/check — no hole card data) |
| `hand.result` | Final result: winning hand, pot distribution, all revealed hole cards |
| `replay_card.ready` | URL of generated replay card (if triggered) |
| `rank.updated` | Player's new rank after session |
| `oracle.analysis` | Hand analysis template output |
| `notification` | General notification (mission complete, streak, referral) |

**Core message types (inbound — client to server):**

| Message Type | Payload Summary |
|---|---|
| `action.fold` | Player fold |
| `action.check` | Player check |
| `action.call` | Player call |
| `action.raise` | `{ amount: number }` |
| `action.allin` | Player all-in |
| `request.oracle` | Request Oracle analysis for last hand |
| `request.replay` | Request replay card for last hand |

### 5.2 REST API (Summary — detailed OpenAPI spec in Architecture doc)

| Endpoint Pattern | Purpose |
|---|---|
| `POST /auth/register` | PWA email registration |
| `POST /auth/login` | PWA email login |
| `POST /auth/telegram` | Telegram initData validation and session creation |
| `GET /lobby` | Available tables and tournaments |
| `POST /tables` | Create a new cash game table |
| `POST /clubs` | Create a new club |
| `GET /clubs/{id}/leaderboard` | Club leaderboard |
| `GET /leaderboard/global` | Global leaderboard |
| `POST /payments/stripe/webhook` | Stripe payment webhook (Stripe-signed) |
| `POST /payments/stars/webhook` | Telegram Stars payment webhook |
| `DELETE /users/me` | GDPR data deletion request |
| `GET /missions/today` | Today's daily missions |

---

## 6. Constraints, Assumptions & Dependencies

### Constraints

- The frontend bundle for the Telegram Mini App core shall not exceed 2 MB (hard limit imposed by target load time; Telegram enforces a 6 MB total Mini App size limit).
- The backend shall be implemented exclusively in Rust; no Node.js, Python, or other runtimes in the critical path.
- SQLite with WAL mode is the production database for months 1–6 (10 000 DAU threshold). Migration path to Turso or PostgreSQL triggers at sustained > 10 000 DAU.
- All writes to SQLite shall go through a single `tokio::sync::mpsc` channel (write serialisation) to prevent WAL contention.
- Infrastructure shall remain on EU-based Hetzner servers at all times.
- The system is designed for zero-merge-conflict AI agent parallelism: each agent owns an isolated module boundary with a defined interface contract; no two agents write to the same file simultaneously.

### Dependencies

| Dependency | Version / Constraint | Risk |
|---|---|---|
| Rust edition 2024, MSRV 1.81 | Pinned in `rust-toolchain.toml` | Low |
| Axum 0.8.9 | WebSocket subprotocol support required | Low |
| SeaORM 2.0.0-rc.38 | RC status; watch for final release | Medium |
| React 19.2.7 | New `<Activity>` API used | Low |
| Vite 8.0.8+ (Rolldown) | Rust-based bundler; 10–30× faster | Low |
| shadcn/ui 4.10.0 | Base UI + Radix; RTL support | Low |
| Tailwind CSS 4.3.0 | CSS-first config (`@theme`) | Low |
| Telegram Mini App API | Policy changes possible | Medium |
| Stripe webhook API | Signature verification required | Low |

---

## 7. TBD Log

| ID | Uncertainty | Owner | Due Date |
|---|---|---|---|
| TBD-001 | Decision: Should The Oracle transition to Claude Haiku API calls from Month 3 (cost ~ 0.0001€/hand at volume)? Impact: significantly richer coaching but introduces external API dependency and cost at scale. | Founder | Month 2 review |
| TBD-002 | Discord bot integration: Month 4 as planned, or bring forward to Month 2 if community Discord forms earlier? | Founder | End of Month 1 |
| TBD-003 | SeaORM 2.0.0 — monitor for stable release. If RC state persists at Month 2 build start, evaluate fallback to sqlx raw queries + manual entity management. | Agent 1 | Pre-build |
| TBD-004 | Web Push notification service: self-hosted web-push or use a managed service (OneSignal free tier)? Cost vs. control trade-off. | Agent 3 | Month 1 sprint 2 |
| TBD-005 | Turso migration trigger: define exact DAU threshold and migration runbook before Month 4. | Agent 1 | Month 3 review |
| TBD-006 | TON blockchain cosmetic NFT layer: permanently remove from roadmap, or keep as Month 5 option? | Founder | Month 4 review |

---

## 8. Requirements Traceability Matrix (Summary)

| BRS ID | SRS Functional Requirements | SRS NFRs |
|---|---|---|
| SN-001 | REQ-FUNC-001, 030 | REQ-NFR-USE-001 |
| SN-002 | REQ-FUNC-002, 003, 004, 005 | REQ-NFR-USE-001, 002 |
| SN-004 | REQ-FUNC-080, 081, 082, 083 | — |
| SN-005 | REQ-FUNC-050, 051 | — |
| SN-006 | REQ-FUNC-060, 061, 062, 063, 064 | REQ-NFR-PERF-004 |
| SN-007 | REQ-FUNC-070, 071, 072, 073 | — |
| SN-008 | REQ-FUNC-018, 019 | — |
| SN-011 | REQ-FUNC-040 | REQ-NFR-USE-003 |
| SN-012 | REQ-FUNC-043 | REQ-NFR-USE-004 |
| SN-013 | REQ-FUNC-041, 042 | REQ-NFR-PERF-007 |
| SN-014 | REQ-FUNC-032, 033, 034, 035, 044 | — |
| BR-001 | REQ-FUNC-093 | REQ-NFR-COMP-004, REQ-NFR-SEC-008, 009 |
| BR-008 | REQ-FUNC-010, 011, 012, 013 | REQ-NFR-SEC-004 |
| BR-009 | REQ-FUNC-100, 101 | REQ-NFR-SEC-005 |
| BR-014 | REQ-FUNC-120, 042 | REQ-NFR-PERF-007 |
| G-2 | REQ-FUNC-050, 051, 052, 053, 054, 055, 056 | — |

---

*End of Document — StackBluff SRS v0.1*
