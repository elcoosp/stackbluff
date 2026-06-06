# StackBluff — Business & Stakeholder Requirements Specification

| Field | Value |
|-------|-------|
| Project | StackBluff |
| Document | L1 — Business & Stakeholder Requirements Specification (BRS) |
| Version | 0.1 (Draft) |
| Date | 2026-06-06 |
| Author | Founder, assisted by AI |
| Status | Draft — Pending Review |
| Traces to | stackbluff-vision.md v0.1 |

---

## 1. Business Context

### 1.1 Purpose & Opportunity

StackBluff exists to capture a specific, time-limited window: no high-quality, Telegram-native, free-to-play poker application exists. The social poker market ($3.2B global, 2025) is served entirely by legacy products built before Telegram Mini Apps existed as a distribution primitive. StackBluff is designed to be the first poker experience built from scratch with Telegram virality as a first-order design constraint.

The business does not depend on paid user acquisition. It depends entirely on a self-reinforcing viral loop: each hand played produces a shareable artefact; each artefact contains an invite; each invite converts at ≥ 15%. This loop, combined with the club system's inherent network-effect compounding, is the primary business engine.

### 1.2 Scope Boundary

**In scope:** Free-to-play Texas Hold'em poker; cosmetic monetisation; club and social system; Telegram Mini App; Progressive Web App; AI coaching via heuristic engine; seasonal ranking; anti-cheat; GDPR/RGPD compliance; Hetzner-hosted infrastructure in the EU.

**Out of scope:** Real-money gambling in any form; native iOS/Android at launch; blockchain features at launch; multi-language support beyond FR/EN at launch; B2B white-label licensing until Month 10.

### 1.3 Business Model Summary

StackBluff monetises through cosmetic goods and subscription products that confer no gameplay advantage:
- **Season Pass** (5.99 €/season, ~8 weeks): seasonal cosmetics, theme access, bonus chips.
- **Chip bundles** (1 €–40 €): chip economy acceleration only, no strategic advantage.
- **Club Pro** (4.99 €/month): club analytics, custom club branding, priority tournament slots.
- **StackBluff Pro** (12.99 €/month, Month 10+): rakeback-equivalent chips, exclusive tournaments.
- **Optional ad tier** (Adsgram, Telegram Stars): ad-supported free chip grants for non-paying users.

All virtual chips have zero cash value. No cash-out path exists or will exist.

---

## 2. Business Goals, Objectives & Success Metrics

Traceability: Goals map directly to G-1 through G-6 in the Vision document.

| ID | Business Objective | Success Metric | Fit Criterion | Vision Ref |
|---|---|---|---|---|
| BG-001 | Achieve product-market fit in France by end of Month 3 | DAU/MAU ratio | ≥ 25% | G-1 |
| BG-002 | Prove self-sustaining viral growth | Viral coefficient K | ≥ 1.3 sustained over 4 weeks | G-2 |
| BG-003 | Generate first revenue within 30 days of launch | MRR | ≥ 1 € (any paying transaction) | G-3 |
| BG-004 | Reach 1 000 € MRR by end of Month 2 | MRR | ≥ 1 000 € | G-3 |
| BG-005 | Reach 1 000 000 € ARR run rate by Month 12 | MRR | ≥ 83 333 € | G-4 |
| BG-006 | Build 5 000 000 registered users by Month 12 | Registered accounts | ≥ 5 000 000 | G-5 |
| BG-007 | Maintain infrastructure cost below 0.5% of MRR at all scales | Infra cost / MRR ratio | ≤ 0.5% monthly | G-6 |
| BG-008 | Maintain full legal compliance at all times | ANJ / CNIL audit status | Zero enforcement actions or fines | G-1, G-4 |
| BG-009 | Achieve paid conversion ≥ 5% of MAU by Month 3 | Paying users / MAU | ≥ 5% | G-4 |

---

## 3. Business Model & Core Processes

### 3.1 Value Stream Map

```
Acquisition (Telegram viral / SEO / Referral)
    └─► Registration (instant, frictionless — Telegram ID or email)
            └─► First Game (within 5 minutes of registration)
                    └─► Hook (Daily mission + Oracle moment + Streak)
                            └─► Social Share (hand replay card → invite)
                                    └─► Monetisation (Season Pass / Chip bundle)
                                                └─► Club Creation (deeper network lock-in)
                                                            └─► Advocacy (streamer, club owner)
```

### 3.2 Core Business Processes

**BP-001 — Viral Table Creation (Telegram)**
A registered user in a Telegram group invokes the `/poker` command. The bot creates a table session. Friends join. A game is played. The bot posts results to the group with an invite link. Non-playing group members see the result and may join.

**BP-002 — Club Lifecycle**
A user creates a Club (free, instant). They invite members via share link. Members play tables hosted under the club. The club leaderboard resets weekly. A monthly trophy is awarded. Club owners may schedule tournaments. Clubs generate their own virality through internal competition.

**BP-003 — Season Pass Purchase & Fulfilment**
A user views the Season Pass offer in the shop. They pay via Telegram Stars (Mini App) or Stripe (PWA). The pass is activated immediately. Seasonal cosmetics are unlocked. At season end (8 weeks), cosmetics are retained but pass expires. A new season with new cosmetics is offered.

**BP-004 — Hand Replay Sharing**
After any significant hand (Royal Flush, bad beat, all-in win, tournament knock-out), the system auto-generates a shareable card. The player receives a one-tap share action. Sharing distributes the card to their social network with an embedded invite link and StackBluff branding.

**BP-005 — Daily Engagement Cycle**
Every 24 hours, a player receives 3 daily missions. Completing missions earns chips. A 7-day streak earns a bonus chip pack. The Oracle provides post-hand coaching. Together these create a reason to return daily.

**BP-006 — AI Coach Session (The Oracle)**
After any hand, a player taps "Oracle". The system analyses the hand using a heuristic engine (50–100 pre-written templates covering preflop, postflop, river, and positional play). The player receives an explanation of optimal play, pot odds, and opponent range estimation. This is available in limited form free and in full form for Season Pass holders.

---

## 4. Business Rules & Policies

| ID | Rule | Rationale | Non-Negotiable? |
|---|---|---|---|
| BR-001 | Virtual chips have zero cash value. No exchange, conversion, gifting for cash equivalent, or crypto backdoor is permitted. | ANJ legal compliance | YES |
| BR-002 | No real-money entry fees for tournaments or cash games, even disguised as cosmetic purchases. | ANJ legal compliance | YES |
| BR-003 | No secondary market for chips or cosmetic items (no P2P trading). | ANJ legal compliance | YES |
| BR-004 | Chip purchases are cosmetic economy acceleration only. A player who never pays must have a path to sufficient chips through gameplay. | ANJ + player trust | YES |
| BR-005 | All personal data must be stored on EU-based infrastructure. | GDPR/RGPD compliance | YES |
| BR-006 | Users must be able to request deletion of all their personal data within 30 days of request. | GDPR Article 17 | YES |
| BR-007 | A daily chip bonus must be available to all free users. The minimum free chip floor must allow at least 10 hands at the lowest stake table per day. | Fair play guarantee | YES |
| BR-008 | The server is the sole authority on game state. No card information shall be transmitted to a client before it is revealed. | Anti-cheat integrity | YES |
| BR-009 | The anti-cheat system must flag and block chip transfer velocity anomalies in real-time (e.g., net transfer > 5 000 chips/day between the same pair of accounts). | Collusion prevention | YES |
| BR-010 | Tournament blind levels must escalate on a fixed timer regardless of hand count. | Game integrity | YES |
| BR-011 | A player who disconnects during a hand is auto-folded after the 60–90 second reconnect window. | Game continuity | YES |
| BR-012 | A Season Pass confers cosmetic benefits only. No Season Pass shall grant a statistical or chip-advantage over a free player at the same table. | Player fairness | YES |
| BR-013 | The Club Pro subscription history must be maintained as a full table of subscription events, not merely an expiry timestamp. | Audit / dispute resolution | YES |
| BR-014 | Leaderboards must refresh at a maximum interval of 5 minutes for global boards. Club boards for clubs with > 500 members must use division sharding (max 500 rows per division). | Performance guarantee | YES |
| BR-015 | The referral bonus must be double-sided: both the inviter and the new user receive a bonus, for the first 1 000 users (triple referral bonus applies in this window). | Viral growth incentive | NO (configurable) |

---

## 5. Stakeholders & User Classes

### 5.1 Stakeholder Map

| Stakeholder | Type | Influence | Primary Concern |
|---|---|---|---|
| Founder | Internal / Owner | Highest | Revenue, legal compliance, product vision |
| AI Agent Collective | Internal / Builder | High | Technical correctness, spec clarity |
| Casual Players | External / Primary Users | High (via churn) | Fun, fairness, ease of access |
| Enthusiast Players | External / Power Users | High (via advocacy) | Skill progression, competitive depth |
| Club Owners | External / Platform Operators | High (network effect) | Club tools, tournament control, prestige |
| Streamers/Creators | External / Amplifiers | Medium–High | Spectator mode, share tools, brand partnership |
| Telegram (platform) | External / Partner | High (distribution) | Policy compliance, API stability |
| ANJ / CNIL | External / Regulator | Critical | Legal compliance, data protection |
| Stripe / Telegram Stars | External / Processor | Medium | Payment ToS compliance |
| Future investors (Series A) | External / Capital | Medium (long-term) | ARR trajectory, user growth, defensibility |

### 5.2 User Personas & Jobs to Be Done

**Persona A — "The Social Spark" (Casual Player)**
- Age: 22–35 · Platform: Telegram-first · Session: 15–30 min, 2–3× per week
- JTBD: "When my friend group is bored on a weekend evening, I want to start a game instantly without anyone downloading anything."
- Success looks like: Table running in < 60 seconds from `/poker` command, no install, everyone can join.

**Persona B — "The Grinder" (Enthusiast)**
- Age: 25–45 · Platform: PWA desktop + mobile · Session: 45–90 min, daily
- JTBD: "When I lose a big pot, I want to immediately understand whether I made a mistake or was just unlucky, so I can track my improvement."
- Success looks like: Oracle delivers specific, accurate analysis within 2 seconds of hand completion.

**Persona C — "The Mayor" (Club Owner)**
- Age: 30–50 · Platform: PWA + Telegram · Session: Variable (organiser role)
- JTBD: "When I want to run my Friday night poker game remotely, I want a club space that feels like it's mine — my branding, my rules, my leaderboard — and I want to schedule tournaments easily."
- Success looks like: Club creation in < 3 taps; tournament scheduling in < 2 minutes; results shared to Telegram group automatically.

**Persona D — "The Broadcaster" (Streamer)**
- Age: 20–40 · Platform: PWA desktop · Session: 1–4 hours, streaming live
- JTBD: "When I stream poker, I want my viewers to be able to watch my table live and participate in the chat energy, while the game also highlights my big moments automatically for clips."
- Success looks like: Spectator mode with live chat; auto-generated highlight cards; OBS-friendly stream overlay.

---

## 6. Glossary / Ubiquitous Language

| Term | Definition | Synonyms / Notes | Forbidden Usage |
|---|---|---|---|
| **Hand** | A single round of poker from deal to showdown or fold | Round, Deal | Do not call it a "game" (a game is a session of multiple hands) |
| **Session** | A continuous period of play by a user at one or more tables | Game session | Not "match" |
| **Table** | A virtual poker table with 2–9 seats, one active game at a time | Room (avoid) | Do not call it a "room" in UI copy |
| **Club** | A persistent, user-created group with its own branding, leaderboard, and tournament schedule | Group, Community | Not "team" or "guild" |
| **Club Owner** | The user who created a club; has admin rights | Admin | Not "host" |
| **Stack** | A player's current chip count at a table | Chips (context-dependent) | Do not confuse with "balance" |
| **Balance** | A player's total chip count across all holdings | Wallet | Never "wallet" (implies cash) |
| **Season Pass** | A one-time purchase valid for one 8-week season granting cosmetic benefits | Premium season | Not "subscription" (it is a one-time purchase, not recurring) |
| **Club Pro** | A recurring monthly subscription for club owners | Club subscription | Must not be described as affecting gameplay |
| **The Oracle** | The AI coaching feature that analyses hands post-completion | AI Coach, Coach | Not "AI" alone; always "The Oracle" in product copy |
| **Replay Card** | An auto-generated shareable image/animation of a significant hand result | Share card, hand card | Not "screenshot" |
| **Daily Mission** | A daily task rewarding chip completion | Quest, Challenge | Use "mission" in all UI copy for consistency |
| **Streak** | A consecutive-day login and mission completion counter | — | Not "combo" |
| **Season** | An 8-week competitive period with a unique cosmetic theme and ranking reset | — | Not "episode" or "chapter" |
| **Rank** | A player's tier within the seasonal ranking system (Brick → Legend) | Tier | Not "level" (levels are separate XP constructs) |
| **Virtual chips** | The in-game currency. Has zero real-world monetary value. | Chips | Never "credits", "coins", or "tokens" (implies real value) |
| **Telegram Stars** | Telegram's native in-app payment currency | Stars | Always "Telegram Stars" in legal copy; "Stars" acceptable in UI |
| **Anti-cheat** | Server-side enforcement rules preventing chip farming, collusion, and bot play | Fraud detection | Not "security" alone |
| **Time bank** | Additional decision time (30 sec/session) available to a player beyond the standard 30-second timer | Bonus time | Not "extra time" |

---

## 7. Conceptual Domain Model

Core entities and their relationships (business level — no architecture implied):

```
USER ─────────── owns ──────────► BALANCE (chip account)
USER ─────────── creates ────────► CLUB (0..N clubs)
USER ─────────── is member of ──► CLUB (0..N memberships)
CLUB ────────── has ─────────────► LEADERBOARD (1 per club)
CLUB ────────── hosts ───────────► TOURNAMENT (0..N)
USER ─────────── sits at ────────► TABLE (0..N sessions)
TABLE ───────── runs ─────────────► HAND (sequence)
HAND ─────────── has ─────────────► HAND_HISTORY (immutable record)
HAND_HISTORY ── triggers ─────────► REPLAY_CARD (0..1 per significant hand)
REPLAY_CARD ──── shared via ──────► REFERRAL_LINK
REFERRAL_LINK ── credits ────────► USER (referrer)
USER ─────────── earns ──────────► MISSION_COMPLETION (daily)
USER ─────────── has ─────────────► SEASON_PASS (0..1 active per season)
USER ─────────── has ─────────────► RANK (1 per season)
USER ─────────── has ─────────────► STREAK (1 per user)
SEASON ─────── contains ─────────► RANK_TIER (Brick, Bronze, … Legend)
PAYMENT ──────── funds ──────────► BALANCE or SEASON_PASS or CLUB_PRO
```

### Key Invariants (Business Rules expressed as constraints)
- A BALANCE can never have a negative chip count after any transaction.
- A HAND_HISTORY record is immutable once the hand completes.
- A USER may not simultaneously hold more than one active Season Pass for the same season.
- A CLUB may have exactly one owner at any time; ownership may transfer but may never be vacant.

---

## 8. Stakeholder Needs & User Requirements

### 8.1 Casual Player (Persona A) Needs

| ID | Need | Priority | Acceptance Idea |
|---|---|---|---|
| SN-001 | Start a multiplayer poker game in < 60 seconds from any Telegram group | Must Have | A `/poker` command in any group creates a joinable table within 5 seconds |
| SN-002 | Play without installing an app | Must Have | Full game playable in Telegram Mini App or PWA without installation |
| SN-003 | Understand the game outcome (who won, why) | Must Have | Hand result displayed clearly with winning hand highlighted |
| SN-004 | Receive free chips to keep playing even without paying | Must Have | Daily bonus chips allow ≥ 10 hands/day at the lowest stake table |
| SN-005 | Share a fun moment from a game with friends | Should Have | One-tap share of replay card to Telegram/social after significant hands |

### 8.2 Enthusiast Player (Persona B) Needs

| ID | Need | Priority | Acceptance Idea |
|---|---|---|---|
| SN-006 | Get accurate, specific coaching after a hand | Must Have | Oracle delivers analysis within 2 seconds of hand completion |
| SN-007 | Track progress over time with a ranking system | Must Have | Seasonal rank visible on profile; rank updates after each session |
| SN-008 | Play in competitive tournaments | Must Have | Sit & Go (Month 1), MTT (Month 4) available |
| SN-009 | Access speed poker to maximise hand volume | Should Have | Speed Poker / Zoom-style mode available (Month 3) |
| SN-010 | Have a fair game with no pay-to-win mechanics | Must Have | No cosmetic or subscription grants statistical chip advantage at the table |

### 8.3 Club Owner (Persona C) Needs

| ID | Need | Priority | Acceptance Idea |
|---|---|---|---|
| SN-011 | Create a club in < 3 steps | Must Have | Club creation flow: name → invite link → done |
| SN-012 | Schedule and run club tournaments easily | Should Have | Tournament scheduling: date/time, blind structure, max players — < 2 minutes to configure |
| SN-013 | See a leaderboard of my club's best players | Must Have | Live club leaderboard visible to all members; refreshes ≤ 5 minutes |
| SN-014 | Have tournament results automatically shared to my Telegram group | Should Have | Bot posts tournament winner + results summary to linked group automatically |
| SN-015 | Customise club branding (Club Pro) | Could Have | Club Pro allows custom chip design, club banner, and table felt colour |

### 8.4 Streamer / Creator (Persona D) Needs

| ID | Need | Priority | Acceptance Idea |
|---|---|---|---|
| SN-016 | Allow viewers to watch my table live | Should Have | Spectator mode with live chip counts and community chat |
| SN-017 | Get automatic clips of big hands for content | Could Have | System auto-flags hands for highlight; share card generated automatically |
| SN-018 | Stream overlay compatible with OBS | Could Have | OBS plugin / browser source URL for stream overlay |

---

## 9. System-in-Context & Operational Concept

StackBluff operates as a multi-platform service in the following external environment:

**External Systems StackBluff interacts with:**
- Telegram Bot API (table invitations, game result posts, tournament reminders)
- Telegram Mini App API (in-app rendering, Telegram.WebApp.initData for auth, Telegram Stars payments)
- Stripe (PWA payment processing)
- Cloudflare (CDN, DDoS protection, DNS)
- Hetzner Cloud (compute, data storage — EU-only)
- Cloudflare R2 (hand history cold storage after 30 days)
- Sentry (error monitoring)
- Prometheus + Grafana (infrastructure metrics)
- Email (Resend — transactional emails for PWA auth)

**How the system participates in user workflows:**
- The Telegram bot acts as a lobby, notification relay, and result broadcaster — it never stores game state.
- The game server is the single source of truth for all game state; clients are thin displays.
- The PWA and Mini App are two presentation layers over the same WebSocket API.
- Payments are processed externally (Stripe/Stars); StackBluff receives only a webhook confirmation; chip credits are applied only after confirmed payment.

---

## 10. Stakeholder-Level Constraints & Quality Expectations

| Stakeholder | Constraint / Quality Expectation |
|---|---|
| All players | The game must be fair, fast (< 10ms action latency), and available 24/7 |
| Casual players | Onboarding must take < 2 minutes; no mandatory tutorial; can play immediately |
| French regulators | Zero cash-out path; GDPR data deletion within 30 days; no tracking without consent |
| Telegram (platform) | Mini App bundle ≤ 6 MB; initial core bundle ≤ 2 MB; Telegram.WebApp API used correctly |
| Founder | Infrastructure cost ≤ 0.5% of MRR at any scale; no vendor lock-in for core game logic |
| Club owners | Club creation instant; tournament scheduling intuitive; results automated |
| AI agent builders | All module interfaces are contract-defined and independently testable; zero merge conflicts by architecture |

---

## 11. Risks, Assumptions & Open Issues

### Business Risks (not duplicated from Vision)

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| BR-RSK-001 | Club system requires critical mass to feel alive; early clubs may feel empty | High — impacts retention | Seed early clubs with staff bots; invite early adopters to a founder club |
| BR-RSK-002 | Season Pass perceived as lacking value if cosmetics are low quality | Medium | Launch with ≥ 5 exclusive cosmetics per season; survey top 100 users in Month 1 |
| BR-RSK-003 | Daily missions become repetitive quickly | Medium | Mission pool of ≥ 30 at launch; rotate weekly; expand with data |

### Assumptions

- French users on Telegram will engage with a poker mini app at a rate consistent with other Telegram gaming mini apps (>10% CTR on bot invite).
- The cosmetic-only monetisation model achieves ≥ 5% paid conversion (consistent with Candy Crush, Among Us benchmarks for polished social games).
- A heuristic Oracle with 50–100 templates covers > 80% of hands in a way players find valuable.

---

## 12. Traceability — Vision Goals → Stakeholder Needs → Features

| Vision Goal | Business Objective | Stakeholder Need(s) | Primary Feature |
|---|---|---|---|
| G-1 Product-market fit | BG-001 DAU/MAU ≥ 25% | SN-001, SN-002, SN-003, SN-004 | Core game + free chip floor |
| G-2 Viral growth K ≥ 1.3 | BG-002 | SN-005, SN-014 | Replay card sharing + Club result posts |
| G-3 First revenue | BG-003, BG-004 | SN-015 (Club Pro) | Season Pass + chip bundles |
| G-4 1M ARR | BG-005, BG-009 | SN-006, SN-007, SN-008 | Oracle + League + MTT |
| G-5 5M registered users | BG-006 | SN-001, SN-011 | Telegram table + Club virality |
| G-6 Infra cost ratio | BG-007 | (Technical, not user-facing) | Rust actor model + SQLite WAL |

---

*End of Document — StackBluff BRS v0.1*
