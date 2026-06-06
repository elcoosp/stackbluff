# StackBluff — Behavioral Specification & Test Verification Plan

| Field | Value |
|-------|-------|
| Project | StackBluff |
| Document | L4 — Behavioral Specification & Test Verification Plan |
| Version | 0.1 (Draft) |
| Date | 2026-06-06 |
| Author | Founder, assisted by AI |
| Status | Draft — Pending Review |
| Traces to | stackbluff-srs.md v0.1, stackbluff-architecture.md v0.1 |

---

## 1. Behavioral Specifications (BDD Scenarios)

### 1.1 Feature: Telegram Table Creation (REQ-FUNC-030)

**Scenario 1 — Happy path: /poker in group**
```gherkin
Given a Telegram group with 6 members including "Alice" who is a registered StackBluff user
When Alice sends "/poker" in the group
Then the StackBluff bot responds within 3 seconds
And the response contains a "Join Table" button
And clicking the button opens the Mini App inside Telegram
And the table is visible in the lobby for all 6 members

Then when 4 members tap "Join Table" within 60 seconds
And the game starts with those 4 players seated
```

**Scenario 2 — Bot responds with invite link**
```gherkin
Given a completed game session in a Telegram group
When the game ends with "Bob" winning with a Full House
Then the bot posts to the originating group within 5 seconds
And the post contains "@Bob won the pot with Full House 🏆"
And the post contains a "Play StackBluff" invite link
And the invite link, when clicked by a non-registered user, begins the registration flow
And the referral is attributed to the player who shared the original /poker command
```

**Scenario 3 — Disconnect during active hand (unwanted behavior)**
```gherkin
Given "Carlos" is in an active hand with the action on him
When Carlos disconnects from the WebSocket
Then the system starts a 60-second reconnect countdown
And the other players see "Carlos disconnected — 60s to reconnect"
When 60 seconds elapse without reconnection
Then Carlos's hand is auto-folded
And the pot is awarded according to normal rules
And Carlos's chip balance is not affected (no chips lost for disconnect beyond the forced fold)
```

---

### 1.2 Feature: Game Engine Correctness (REQ-FUNC-010, 011, 012)

**Decision Table: Hand Rankings**

| Player 1 Hole Cards | Player 2 Hole Cards | Community Cards | Expected Winner | Winning Hand |
|---|---|---|---|---|
| A♠ K♠ | Q♥ J♦ | A♥ K♦ 8♣ 2♦ 5♠ | Player 1 | Two Pair (Aces and Kings) |
| 7♣ 2♦ | A♠ K♠ | A♦ K♦ A♥ K♥ 7♦ | Player 2 | Four of a Kind (Aces) |
| A♠ A♦ | A♥ A♣ | K♠ Q♠ J♠ 10♠ 9♠ | Split pot | Both play the board (Royal Flush) |
| 5♦ 4♦ | K♠ K♦ | 6♦ 3♦ 2♦ K♥ A♦ | Player 1 | Straight Flush (A-2-3-4-5 in diamonds — the wheel) |
| 2♠ 3♥ | 2♥ 3♦ | 2♦ 3♠ A♠ K♠ Q♠ | Split pot | Both have Full House 3s full of 2s |

**Scenario: CSPRNG shuffle verification**
```gherkin
Given a standard 52-card deck
When the deck is shuffled 1,000,000 times
Then the chi-squared test on card position distribution has p-value > 0.05
And no shuffle sequence is identical to any other (collision probability < 0.001% over 1M trials)
And no client receives knowledge of any card before it is dealt face-up
```

**Scenario: Server-side card authority (unwanted behavior)**
```gherkin
Given "Eve" has joined a table as Player 2
When Eve intercepts the WebSocket messages sent to her connection
Then she sees her own hole cards only after "hand.dealt" message for her seat
And she sees NO hole card data for any other player's "hand.dealt" message
And at showdown, other players' hole cards are revealed in the "hand.result" message only
```

---

### 1.3 Feature: Decision Timer (REQ-FUNC-015, 016)

**State Transition Diagram:**

```
[ACTION REQUIRED] ──(timer starts T=0)──► [COUNTING DOWN 30s]
                                                  │
                              (player acts) ◄─────┤──(T=30s, time bank > 0)──► [TIME BANK ACTIVE]
                                   │                                                     │
                                   ▼                                      (player acts) ◄┤──(bank = 0)──► [AUTO-FOLD]
                             [NEXT ACTION]                                               │
                                                                                         ▼
                                                                                    [NEXT ACTION]
```

**Scenario: Time bank usage**
```gherkin
Given "Diana" has 30 seconds of time bank remaining
And the main 30-second timer has expired
Then the time bank counter starts decrementing
And Diana's timer display shows "time bank: 29s, 28s..." decrementing
When Diana folds after 15 seconds of time bank
Then 15 seconds are deducted from her remaining time bank (15s remaining)
And the time bank persists for the rest of the session

When Diana's time bank reaches 0 on a subsequent hand
Then her hand is auto-folded immediately
And a notification "Diana is out of time bank" is broadcast to the table
```

---

### 1.4 Feature: Chip Economy Integrity (REQ-NFR-SEC-009, REQ-FUNC-093)

**Scenario: Payment two-phase commit**
```gherkin
Given "Erik" initiates a chip bundle purchase for 50 Stars
When the Telegram Stars payment is initiated
Then the system logs a "PENDING" transaction with idempotency key = payment_id
And Erik's chip balance is NOT yet increased
When the Telegram Stars payment webhook arrives with valid HMAC signature
Then Erik's chip balance is increased by the bundle amount (50,000 chips)
And the transaction is logged as "CONFIRMED"
And the idempotency key prevents any duplicate credit if the webhook fires twice

When the webhook does NOT arrive within 10 minutes
Then the pending transaction is marked "EXPIRED"
And Erik's balance remains unchanged
And Erik receives a notification: "Payment could not be verified. Please contact support."
```

**Scenario: Anti-cheat chip velocity**
```gherkin
Given "Alice" and "Bob" are two accounts sharing the same IP address
When Alice wins 3,000 chips from Bob at 9:00 AM
And Alice wins 2,500 chips from Bob at 10:00 AM (total: 5,500 chips in the same direction)
Then the system flags both accounts for collusion review at the 5,001 chip threshold
And subsequent heads-up games between Alice and Bob are blocked
And the flag is logged in the anti_cheat_events table with: both user IDs, IP, timestamps, amounts
And neither account is banned automatically (human review required)
```

---

### 1.5 Feature: Oracle Heuristic Engine (REQ-FUNC-060–064)

**Decision Table: Template Selection**

| Scenario Type | Pre-flop action | Board texture | Result | Expected Template Category |
|---|---|---|---|---|
| Hero raises 5x BB pre-flop with A-A | Raise 5BB | — | Any | "Pre-flop oversizing: standard is 2.5–3x BB" |
| Hero calls river bet with 30% pot odds, needs 25% equity | Call | Paired board | Win | "Pot odds satisfied: {X}% needed, {Y}% available" |
| Hero folds flush draw with 4:1 pot odds (needs 4:1) | Fold river | Flush board | Correct fold | "Pot odds: marginal fold — {X}% needed vs {Y}% available" |
| Hero bets all-in on the flop with middle pair | All-in | Dry board | Any | "Overbet: consider a smaller bet with showdown value" |
| Hero wins with suited connector after correct call | Call | Straight board | Win | Compliment template: "Nice read — smooth call in position paid off" |

**Scenario: Oracle response time under load**
```gherkin
Given 500 players simultaneously tap the Oracle button after a hand
Then all 500 Oracle responses are delivered within 2 seconds (p99)
And response time is measured from the server receiving the request to the client displaying the analysis
And no Oracle request is dropped or times out
```

---

### 1.6 Feature: Anti-Cheat — Server State Authority (REQ-FUNC-102)

**Scenario: Client cannot cheat by modifying messages (unwanted behavior)**
```gherkin
Given a player's chip balance is 10,000
When the client sends a "action.raise" message with amount = 9,999,999 (exceeding stack)
Then the server rejects the raise and responds with an error: "raise_exceeds_stack"
And the server logs a potential exploit attempt with the player's session ID
And the player's stack remains 10,000
And the table continues without interruption
```

---

## 2. Test Strategy & Plan

### 2.1 Test Pyramid Stance

```
         ╱▲╲
        ╱ E2E╲         ~5% of tests
       ╱──────╲        Manual: Telegram Mini App full flow
      ╱  Integ. ╲      ~20% of tests
     ╱────────────╲    WebSocket protocol, DB transactions, payment webhooks
    ╱    Unit Tests ╲  ~75% of tests
   ╱──────────────────╲ Game engine, Oracle templates, anti-cheat rules, chip math
```

**Rationale for test pyramid shape:**
- Game engine correctness is **critical and deterministic** → high unit test investment.
- WebSocket protocol and payment flows have **integration complexity** → integration tests.
- E2E tests are expensive to maintain and the Telegram Mini App changes frequently → keep minimal, focused on the core viral loop.

### 2.2 Test Tools & Frameworks

| Layer | Tool | Notes |
|---|---|---|
| Rust unit & integration | `cargo-nextest` 0.9.132+ | Faster than `cargo test`; parallel by default |
| Rust mocks | `mockall` 0.14.0 | Mock trait implementations for module boundaries |
| Load testing | `k6` or custom Rust load harness | Target: 5 000 concurrent WS connections |
| Frontend unit | `vitest` 4.0.0 | Vite-native; same config as build |
| Frontend component | `@testing-library/react` | Component interaction tests |
| E2E | Manual Telegram + Playwright (PWA) | Playwright for PWA flows; Telegram must be manual |
| Security | `cargo-deny` 0.19.0 | Dependency advisory scanning |
| Dependency audit | `cargo vet` | Supply chain verification |

### 2.3 Risk-Based Test Prioritisation

| Priority | Area | Risk Level | Test Coverage Target |
|---|---|---|---|
| P1 | Game engine (hand evaluator, timer, chip math) | Critical — chip errors = user trust collapse | 100% branch coverage |
| P1 | Payment flow (two-phase commit, idempotency) | Critical — financial integrity | 100% of scenarios in §1.4 |
| P1 | Server-side card authority | Critical — cheating risk | 100% of §1.2 card scenarios |
| P2 | Anti-cheat velocity checks | High | All decision table cases |
| P2 | WebSocket disconnect/reconnect flows | High — affects UX at scale | All §1.1 Scenario 3 variants |
| P3 | Oracle template output | Medium | 100% template coverage; spot-check accuracy |
| P3 | Club leaderboard correctness | Medium | Boundary conditions (499/500/501 members) |
| P4 | UI rendering | Low | Snapshot tests; visual regression via Storybook |

---

## 3. Test Case Specifications (Selected Critical Path)

### TC-001: Hand Evaluator — Wheel Straight Flush

| Field | Value |
|---|---|
| ID | TC-001 |
| Requirement | REQ-FUNC-010 |
| Precondition | Game engine initialised; no active tables |
| Test input | Player hole cards: 5♦ 4♦; Community: 6♦ 3♦ 2♦ K♥ A♦ |
| Steps | Call `evaluate_hand(hole_cards, community_cards)` |
| Expected result | Returns `HandRank::StraightFlush { high: Five }` (A-2-3-4-5 of diamonds) |
| Actual result | TBD |
| Pass criteria | Return value matches expected; no panic; execution < 1μs |

### TC-002: Timer — Auto-Fold at Expiry

| Field | Value |
|---|---|
| ID | TC-002 |
| Requirement | REQ-FUNC-015 |
| Precondition | Table with 3 players; action on Player 2 (no time bank remaining) |
| Test input | No action received for 30 seconds (simulated via tokio::time::advance) |
| Steps | Advance mock time by 30 seconds; observe table actor state |
| Expected result | Player 2 is folded; next action moves to Player 3; hand history records auto-fold |
| Pass criteria | Fold fires at exactly T=30s (±100ms tolerance); no hand history corruption |

### TC-003: Payment — Idempotent Webhook

| Field | Value |
|---|---|
| ID | TC-003 |
| Requirement | REQ-FUNC-093, REQ-NFR-SEC-008 |
| Precondition | User with 10,000 chips; pending transaction with idempotency key "pay_abc123" |
| Test input | POST `/payments/stripe/webhook` with valid signature and payment_id "pay_abc123" — sent twice |
| Expected result | First call: chips credited; balance = 60,000. Second call: idempotency key detected; chips NOT credited again; balance remains 60,000 |
| Pass criteria | Balance exactly 60,000 after both calls; second call returns HTTP 200 (idempotent, not error) |

### TC-004: Chip Velocity Anti-Cheat Flag

| Field | Value |
|---|---|
| ID | TC-004 |
| Requirement | REQ-FUNC-100 |
| Precondition | Two user accounts; no prior flags; 0 chips transferred between them today |
| Test input | Simulate 5 consecutive heads-up hands where Account A wins 1,100 chips from Account B each time (total: 5,500 chips) |
| Expected result | After the 5th hand (cumulative > 5,000), anti-cheat flag created; next game between these accounts blocked; admin alert logged |
| Pass criteria | Flag created; game blocked; no automated ban; admin event log entry present |

### TC-005: WebSocket Card Isolation

| Field | Value |
|---|---|
| ID | TC-005 |
| Requirement | REQ-FUNC-012, REQ-NFR-SEC-004 |
| Precondition | 2-player table; hand in progress |
| Test input | Capture all WebSocket messages received by Player 2's connection throughout a full hand |
| Expected result | Player 2's connection receives `hand.dealt` message containing only Player 2's hole cards. Player 1's hole cards appear ONLY in the `hand.result` message (showdown). |
| Pass criteria | Zero occurrences of Player 1's hole card data in Player 2's message stream before showdown |

### TC-006: Oracle Response Time Under Load

| Field | Value |
|---|---|
| ID | TC-006 |
| Requirement | REQ-FUNC-060, REQ-NFR-PERF-004 |
| Precondition | Server with simulated hand history for 500 distinct users |
| Test input | 500 concurrent `request.oracle` WebSocket messages sent simultaneously |
| Expected result | All 500 Oracle responses delivered; p99 response time ≤ 2000ms |
| Pass criteria | `p99 <= 2000ms` in test output; no requests dropped or timed out |

### TC-007: Leaderboard Refresh

| Field | Value |
|---|---|
| ID | TC-007 |
| Requirement | REQ-FUNC-120, BR-014 |
| Precondition | Global leaderboard materialised view exists; Player A has won 50,000 chips in the last hand |
| Test input | Wait ≤ 5 minutes; query `GET /leaderboard/global` |
| Expected result | Player A's new total is reflected in the leaderboard response |
| Pass criteria | Response reflects the update within 300 seconds of the hand completing; query returns in ≤ 200ms |

---

## 4. NFR Verification Plans

### 4.1 Performance Verification — WebSocket Latency (REQ-NFR-PERF-001)

**Load test specification:**

```yaml
# k6 load test — ws_latency.js
test_name: WebSocket Action Latency Under Load
target:
  concurrent_tables: 1000
  players_per_table: 3000  # avg 3 per table
  test_duration: 10 minutes
  action_rate: 2 actions/second/player (conservative)

slo_thresholds:
  p99_latency_ms: 10   # server-to-server round trip
  error_rate: 0.001    # < 0.1% errors

measurement:
  # Server instruments action receipt timestamp and response sent timestamp
  # Latency = response_sent_ts - action_received_ts (server-side only; excludes network)
  metric: server_action_latency_ms

ramp_up:
  0s → 200 concurrent tables: 60s
  200 → 1000 concurrent tables: 120s
  sustain 1000 tables: 480s

pass_criteria:
  - p99 server latency ≤ 10ms throughout sustain phase
  - No table actor panics
  - Error rate < 0.1%
```

### 4.2 Performance Verification — Bundle Size (REQ-NFR-PERF-005, 006)

- **Tool:** `vite-bundle-visualizer` + `du -sh dist/` after each production build
- **CI gate:** GitHub Actions step fails if `dist/core.js` > 2 048 KB
- **Measurement:** Lighthouse CI on staging — time-to-interactive on throttled 4G (25 Mbps, 40ms RTT)
- **Pass criterion:** Core bundle ≤ 2 048 KB; Lighthouse TTI ≤ 3 000ms

### 4.3 Security Verification — OWASP Alignment

| OWASP Category | StackBluff Test |
|---|---|
| A01 Broken Access Control | TC-005 (card isolation); test all endpoints without auth (expect 401) |
| A02 Cryptographic Failures | Verify TLS 1.3 with `testssl.sh`; verify Argon2id params via unit test |
| A03 Injection | Fuzz all text inputs (username, chat messages) with SQLi and XSS payloads; SeaORM parameterised queries are the primary mitigation |
| A07 Identification Failures | Verify JWT expiry, Telegram initData HMAC validation, rate limiting on auth endpoints |
| A09 Security Logging Failures | Verify anti-cheat flag events are logged; verify exploit attempts are logged (TC-004) |
| A10 SSRF | Verify no server-side URL fetch triggered by user input |

### 4.4 GDPR Compliance Verification (REQ-NFR-COMP-001–005)

| Requirement | Verification Method |
|---|---|
| Cookie consent banner | Manual walkthrough on fresh browser session; analytics cookies absent before consent |
| Data deletion (Art. 17) | Call `DELETE /users/me`; verify user row deleted + PII nulled within 30-day SLO; hand history anonymised (user_id → null) |
| No PII in logs | Grep production Sentry events for email patterns; grep game logs for email regex |
| EU data residency | Verify Hetzner VPS region via `curl https://api.hetzner.cloud/v1/servers`; confirm "location": "nbg1" or "fsn1" |

---

## 5. Requirements Traceability Matrix (RTM)

| Business Goal | Stakeholder Need | System Requirement | BDD Scenario | Test Case |
|---|---|---|---|---|
| G-2 Viral K≥1.3 | SN-001 (Telegram table) | REQ-FUNC-030 | §1.1 Scenario 1, 2 | Manual E2E TG-01 |
| G-1 PMF | SN-004 (free chips) | REQ-FUNC-080–083 | §1.1 Scenario implied | TC-missions-01 (TBD) |
| G-1 PMF | SN-006 (Oracle) | REQ-FUNC-060–064 | §1.5 Oracle scenarios | TC-006 |
| G-4 ARR | BR-001 (no cash-out) | REQ-NFR-COMP-004 | N/A (structural) | Endpoint audit (all routes) |
| G-4 ARR | SN-008 (payments) | REQ-FUNC-090–094 | §1.4 Payment scenarios | TC-003 |
| BG-008 Compliance | BR-005 (GDPR) | REQ-NFR-COMP-001–005 | N/A | §4.4 GDPR checks |
| All goals | BR-008 (game integrity) | REQ-FUNC-010–013 | §1.2 hand rankings | TC-001, TC-005 |
| BG-001 PMF | BR-009 (anti-cheat) | REQ-FUNC-100–103 | §1.4 chip velocity | TC-004 |
| G-6 Infra cost | REQ-NFR-PERF-001 | REQ-NFR-PERF-001 | §4.1 load test | Load test: ws_latency |

---

## 6. Living Documentation Strategy

### 6.1 How Specs Stay in Sync With Code

- **BDD scenarios** live in `tests/bdd/` as `*.feature` files (gherkin format). Agent 5 owns these files. Each feature file has a `# SRS: REQ-FUNC-xxx` header comment for traceability.
- **Unit tests** reference requirement IDs in doc comments: `/// Tests REQ-FUNC-010: hand evaluator wheel straight flush`.
- **ADRs** are stored in `docs/adr/` and updated whenever the architecture doc changes. Superseded ADRs are not deleted — they are marked `Status: Superseded by ADR-xxx`.
- **Spec review cadence:** SRS and Architecture reviewed at the start of each month. Any requirement changed during a sprint is flagged by the responsible agent with a `// SPEC-CHANGE: REQ-FUNC-xxx updated in SRS v0.2` comment in the PR.
- **TBD log** is reviewed at every monthly retrospective. Each resolved TBD becomes an ADR or a new requirement.

### 6.2 Spec Update Triggers

| Trigger | Document(s) Updated | Owner |
|---|---|---|
| New game variant added (PLO, OFC) | SRS §3.2, Architecture §4.3 | Agent 1 + Founder |
| Oracle transitions to LLM API (TBD-001) | SRS §3.6, Architecture ADR-005 | Agent 1 + Agent 3 |
| SQLite → Turso/PostgreSQL migration | Architecture §4.4, §7.4, ADR-002 | Agent 1 |
| Telegram Mini App API breaking change | SRS §5.1, Architecture §4.5 | Agent 3 |
| Season Pass pricing change | BRS §3.1, SRS REQ-FUNC-091 | Founder |
| New anti-cheat rule | BRS BR-xxx, SRS REQ-FUNC-10x | Agent 5 + Founder |

---

*End of Document — StackBluff Verification Plan v0.1*
