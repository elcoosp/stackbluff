# StackBluff — Product Vision & Strategic Alignment

| Field | Value |
|-------|-------|
| Project | StackBluff |
| Document | L0 — Product Vision & Strategic Alignment |
| Version | 0.1 (Draft) |
| Date | 2026-06-06 |
| Author | Founder, assisted by AI |
| Status | Draft — Pending Review |

---

## 1. Vision Statement

StackBluff is a free-to-play, multi-platform social poker platform that makes competitive poker accessible, viral, and beautiful — capturing France first, then Europe, then the world — reaching 1 000 000 € ARR within its first operational year on a near-zero budget, built entirely by AI agents.

> **Pichler one-liner:** *A viral social poker platform that turns every friend group into a poker club, every hand into a shareable moment, and every player into a recruiter — at zero marginal cost per user.*

---

## 2. Elevator Pitch (Moore's Template)

**For** casual and enthusiast poker players in France and Europe **who are dissatisfied with** slow, ugly, pay-to-win legacy social poker apps that offer no genuine social depth or skill progression, **our product** StackBluff **is** a free-to-play multi-platform poker platform **that provides** instant viral table creation, club-based social play, real skill coaching, and a seasonal competitive meta. **Unlike** Zynga Poker, WSOP App, or Pokerstars Play, **our product** is Telegram-native, built on a sub-10ms Rust/WebSocket engine, costs nothing to play, and turns every hand into a shareable social moment.

---

## 3. Problem Statement & Business Context

### Why This Matters Now

The global social poker market generates $3.2B annually (2025) yet is dominated by decade-old, bloated applications with aggressive monetisation, poor mobile performance, and zero Telegram integration. Three structural forces create an immediate window:

1. **Telegram explosion:** The Telegram Mini App ecosystem emerged as the most viral distribution channel in the world (Hamster Kombat: 300M users in 90 days). No high-quality poker game exists natively inside Telegram.
2. **Free-to-play legal clarity:** France's ANJ regulates only real-money gambling. A play-money model is entirely exempt — the same basis on which Zynga Poker operates globally. There is no regulatory barrier.
3. **AI-first build economics:** The combination of Rust performance and AI agent development eliminates the traditional team-cost barrier to competing with incumbent platforms. A solo founder can ship a competitor-grade product in weeks.

### What Is Broken Today

- Existing social poker apps are slow (React/Java stacks), ugly, and riddled with pay-to-win mechanics that destroy trust.
- None are designed for Telegram's group-chat paradigm where a game could be summoned mid-conversation.
- None offer genuine skill progression — only chip treadmills.
- Their viral coefficients are effectively zero; growth depends entirely on paid acquisition.

---

## 4. Target Users & Anti-Scope

### Primary Users (Building For)

| User Class | Description | Size Estimate |
|---|---|---|
| **Casual social players** | Play poker with friends occasionally; value ease and fun over depth | 70% of TAM |
| **Enthusiast / semi-serious players** | Seek skill improvement; appreciate coaching and competitive ranking | 20% of TAM |
| **Club organisers** | Run friend groups, poker nights, or small communities; want to host tournaments | 8% of TAM |
| **Streamers & content creators** | Play publicly, share highlights; drive organic viral loops | 2% of TAM |

### Anti-Scope: Who We Are NOT Building For

- **Real-money gamblers** — not a competitor to PokerStars, Winamax, or any ANJ-licensed operator. StackBluff will never process real wagers.
- **Hardcore tournament grinders** — players requiring official prize pools, escrow, or live event integration.
- **B2C mobile-only users without Telegram** — not our launch beachhead; addressed from Month 3.
- **Enterprise / white-label casino operators** — considered only as B2B revenue from Month 10.

---

## 5. User Needs & Value Proposition

### Top Three User Needs

| # | Need | StackBluff's Answer |
|---|---|---|
| N-1 | *Play poker instantly with my actual friends, wherever they are* | Telegram group command `/poker` → table in 10 seconds; no install |
| N-2 | *Understand why I lost and get better* | AI Coach "The Oracle" — post-hand analysis explaining optimal play, pot odds, opponent range |
| N-3 | *Feel like I'm part of a community and progressing* | Club system + Seasonal League (Brick → Legend) + Daily Missions + Streak rewards |

### Differentiators

- **Telegram-native table summoning** — no competitor offers this at any quality level.
- **Sub-10ms WebSocket latency** — Rust actor model; 10× faster than any JS/JVM alternative.
- **Viral mechanics by design** — every hand generates a shareable replay card with embedded invite link.
- **Zero pay-to-win** — all purchases are purely cosmetic; chips are free and plentiful.
- **AI coach at no marginal cost** — heuristic engine with 100 hand-analysis templates; no LLM API cost at scale.

---

## 6. Desired Outcomes & Success Metrics

### Business OKRs

| ID | Objective | Key Result | Target |
|---|---|---|---|
| G-1 | **Achieve product-market fit** | DAU/MAU ratio | ≥ 25% by Month 3 |
| G-2 | **Prove viral growth engine** | Viral coefficient K | ≥ 1.3 by Month 2 |
| G-3 | **Reach revenue sustainability** | MRR | ≥ 1 000 € by Month 2 |
| G-4 | **Cross 1M € ARR** | MRR | ≥ 83 333 € by Month 12 |
| G-5 | **Establish Telegram market leadership** | Registered users | ≥ 5 000 000 by Month 12 |
| G-6 | **Maintain near-zero infrastructure cost ratio** | Infra cost as % of MRR | ≤ 0.5% at any scale |

### Product Metrics

- **DAU targets:** 100 (M1) → 1 000 (M2) → 5 000 (M3) → 50 000 (M6) → 300 000 (M12)
- **Session length:** ≥ 12 minutes average by Month 2
- **Referral conversion:** ≥ 15% of invited users complete first game
- **Paid conversion (MAU → paying):** ≥ 5% by Month 3

---

## 7. Strategic Constraints

| Type | Constraint |
|---|---|
| **Legal** | Play-money only; no real-money exchange, crypto conversion, or P2P chip trading. GDPR/RGPD compliant from day one. |
| **Financial** | Total initial cash budget: 100 €. Infrastructure ops: ≤ 90 €/first 3 months. All scaling funded from revenue. |
| **Platform** | Must operate as Telegram Mini App AND Progressive Web App from Week 1. iOS/Android native apps deferred to Month 3. |
| **Team** | Solo human founder + 5 AI agents (Claude, or DeepSeek R1/V3 equivalents). No employees until Series A. |
| **Timeline** | MVP live Week 1. Telegram launch Week 2. Club system Month 2. 1M ARR by Month 12. |
| **Stack** | Rust + Axum backend; React + Vite SPA frontend; SQLite (WAL mode); Hetzner VPS. Stack changes require founder approval. |
| **Architecture** | Highly modular, agent-parallelisable; zero merge conflicts by design. Each subsystem is an isolated Rust actor or front-end module with a clean interface contract. |

---

## 8. Goals & Non-Goals

### Goals (In Scope)

- G-1 through G-6 above.
- Telegram Mini App with `/poker` group table summoning.
- PWA with full game, no install required.
- Texas Hold'em as the primary game variant at launch.
- Club system: creation, invitation, leaderboards, club tournaments.
- Cosmetic monetisation: Season Pass (5.99 €/season), chip bundles, avatar items.
- AI Coach "The Oracle" using heuristic templates (no LLM API cost).
- Seasonal ranking system (Brick → Legend).
- Anti-cheat: server-side state only, chip transfer velocity caps.
- GDPR/CNIL compliance architecture from day one.

### Non-Goals (Explicitly Out of Scope)

- **Real-money play or any cash-out path** — ever, in any form, including crypto.
- **Native iOS/Android apps in Month 1** — PWA wrapper is sufficient; App Store submission deferred to Month 6.
- **LLM API calls for The Oracle at launch** — heuristic engine only; avoids API cost at scale.
- **Poker variants beyond Texas Hold'em at launch** (PLO, OFC, Short Deck deferred to Months 3–5).
- **TON blockchain / NFT cosmetic layer** — deferred to Month 5 as optional.
- **Multi-language support** — French and English only at launch; German/Spanish deferred to Month 5.
- **Desktop-native app** — browser-based PWA is the desktop experience.
- **B2B white-label / club API** — deferred to Month 10.
- **Paid advertising / UA spend** — all growth is organic in Months 1–3; paid UA unlocked from revenue at Month 4.

---

## 9. Operational Concept & Key Scenarios

### Scenario 1 — Telegram Group Table (Core Viral Loop)

1. Alice is in a Telegram group with 8 friends.
2. She types `/poker` — the StackBluff bot sends a "Join Table" card.
3. 6 friends tap to join within 60 seconds; the Mini App opens inside Telegram.
4. They play a cash game hand; chips update in real-time.
5. After the session, the bot posts results to the group: "@Alice won 45 000 chips with a Full House 🏆".
6. The result card contains an invite link. Two non-players tap it → new users registered.

### Scenario 2 — Daily Engagement Loop (Retention)

1. Bob opens the StackBluff PWA on his phone.
2. He sees 3 daily missions: "Win a hand with a flush", "Bluff successfully 2 times", "Play 5 hands before 10AM".
3. He plays 20 minutes, completes 2 missions, earns chips.
4. His 7-day streak is maintained; he gets a "Streak Shield" notification from the bot.
5. He taps The Oracle on his best hand → understands his pot odds mistake → shares the analysis to his poker Discord.

### Scenario 3 — Club Creation (Club Owner Viral Loop)

1. Carlos creates "Paris Poker Club" — 3 taps, no friction.
2. He invites 15 friends via Telegram share link.
3. The club has a live leaderboard. Carlos schedules a Saturday MTT.
4. 12 members join the tournament; bot sends countdown reminders.
5. The winner's result card is posted to the club's linked Telegram group.
6. 4 spectators watching become new registered users.

### Scenario 4 — Oracle Skill Loop (Loyalty/Upgrade Driver)

1. Diana plays a tournament hand — she folds a flush draw on the river.
2. She taps The Oracle button.
3. Oracle delivers: "Pot odds were 3:1; your flush draw was 4:1 — correct fold. However, your pre-flop 3-bet sizing was 3x BB from the button with A9s; standard is 2.5x."
4. Diana feels she is learning. She upgrades to Season Pass to unlock advanced Oracle templates.

### Scenario 5 — Epic Hand Viral Share

1. Erik gets a royal flush in a live tournament.
2. StackBluff auto-generates a cinematic replay card: animated card reveal, chip amount, "Erik's Royal Flush — 1 in 649,740 hands!".
3. One tap shares to Twitter/X and Telegram story.
4. The share card has a prominent "Play Free" CTA with an invite link.

---

## 10. Stakeholders & Governance

| Stakeholder | Role | Decision Authority |
|---|---|---|
| **Founder (human)** | CEO/CPO/CTO | Final authority on all product, technical, and business decisions |
| **AI Agent Collective** (5 agents) | Engineering team | Execute within sprint scope; no deployment without founder approval |
| **Players (users)** | Primary customers | Inform via feedback, session metrics, and community posts |
| **Club owners** | Power users / advocates | High-value stakeholders for retention; early access to Club Pro beta |
| **French regulators (ANJ/CNIL)** | Legal constraint | Must be satisfied proactively; no negotiation on play-money compliance |
| **Telegram** (platform) | Distribution partner | Subject to Mini App policy changes; PWA is the fallback hedge |
| **Stripe / Telegram Stars** | Payment processor | Subject to ToS; multi-processor strategy mitigates lock-in |

**Governance model:** Founder is sole owner of Vision, Strategy, and Architecture. Decisions made daily in morning reviews. Vision document reviewed quarterly or upon any material change to revenue targets, platform policy, or legal context. All changes logged with version numbers and rationale.

---

## 11. Risks, Assumptions & Open Questions

### Key Risks

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Telegram changes Mini App monetisation policy | Low | High | PWA is primary; Telegram is distribution layer only |
| R-2 | Viral growth K < 1.0 in Month 1–2 | Medium | High | Paid UA from first revenue; Discord/Reddit organic backup |
| R-3 | Legal challenge on free-to-play model | Low | Critical | Strict no-cash-out rule; CNIL proactive declaration Month 2 |
| R-4 | AI agent produces untestable / buggy code | High | Low | Agent 5 QA gate + human review; nothing deploys without approval |
| R-5 | Competitor replicates features faster | High | Medium | Rust performance moat + community network effects + speed |
| R-6 | Paid conversion < 2% at Month 3 | Medium | High | Pivot cosmetic pricing; add ad tier; reduce Season Pass price |
| R-7 | Infrastructure cost spikes unexpectedly | Low | Medium | Rust efficiency; auto-scaling alerts at 80% capacity |

### Assumptions

- France's free-to-play poker exemption from ANJ regulation remains in force throughout the roadmap.
- Telegram Mini App APIs remain stable and free for third-party developers.
- SQLite WAL mode is sufficient for up to 10 000 DAU without horizontal database scaling.
- A single Hetzner CAX11 (2 vCPU, 4 GB RAM) handles 500+ concurrent WebSocket connections.
- A viral coefficient of K ≥ 1.3 is achievable given the Telegram group table mechanic.

### Open Questions

| ID | Question | Owner | Due |
|---|---|---|---|
| OQ-1 | Should The Oracle use Claude Haiku API from Month 3 (cost: <0.0001€/hand) or remain heuristic-only? | Founder | Month 2 review |
| OQ-2 | Discord bot integration: Month 4 as planned, or earlier if community demand appears? | Founder | Month 2 review |
| OQ-3 | TON blockchain cosmetic layer: pursue or permanently remove from roadmap? | Founder | Month 4 review |
| OQ-4 | Apple Developer Account: fund from revenue at Month 6 (99 €/year)? | Founder | Month 5 |

---

*End of Document — StackBluff Vision v0.1*
