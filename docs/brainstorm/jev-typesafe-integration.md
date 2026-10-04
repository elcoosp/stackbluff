# Integrating TypeSafe's Jev into StackBluff

> **Brainstorm** · 2026-09-19 · Scope: full sweep (Oracle coach, poker bots, anti-cheat, engagement/ops)
> Constraints honored: €100 bootstrap budget · sub-10ms Rust/WebSocket engine · play-money, GDPR-compliant
> Companion to `docs/brainstorm/gto-bot.md` (GTO solver + adaptive bots) — Jev is the missing "fast judgment" piece that idea deferred.
> **v1.1** — written with the official `typesafe-ai` agent skill installed; all request/response examples re-verified against the live docs (`/api`, `/primitives`, `/state`, `/confidence`, `/models`).

---

## TL;DR

**Yes — and the fit is unusually clean.** Jev is not a chatbot and not an LLM replacement. It is a *System One decision model*: you send a `state` (string/JSON) plus typed questions (**Choice**, **Score**, **Noul**), and it returns structured, calibrated answers with probabilities and confidence — no text generation, no parsing, no prompt-crafting rabbit hole. StackBluff already has the exact shape of problem Jev solves: at least four crates currently make *judgment calls with hand-rolled heuristics* — the Oracle picks coaching templates by threshold matching, poker bots decide via equity cutoffs plus RNG, anti-cheat flags collusion with binary counters, and missions are assigned by seeded RNG.

The winning mental model for the integration:

> **Jev decides, Rust executes, templates speak.**
> Keep all arithmetic (equity, pot odds, thresholds) in Rust. Use Jev for the semantic judgment ("what kind of spot is this?", "does this transfer pattern look like laundering?", "what story is this hand?"). Render all user-facing text from your existing localized templates, because Jev cannot generate prose anyway.

**Top-3, if you only do three things:**

| # | Integration | Crate | Why first |
|---|---|---|---|
| 1 | **Oracle v2** — semantic spot classification behind the existing template library | `sb-oracle` | Monetized surface (Season Pass gate already exists), pure on-demand REST, zero risk to the game loop, replaces a hardcoded `0.85` confidence with a real calibrated one |
| 2 | **Bot brains v2** — Jev judgment on "hard" spots only, local heuristic fallback | `sb-poker-bots` | "Bots that feel human" is your differentiator; the bot's existing 500–2000 ms human-delay window absorbs the API round-trip for free |
| 3 | **Anti-cheat triage** — graded, confidence-gated review queue for transfers & collusion | `sb-anti-cheat` | Fully async, converts false-positive-prone binary thresholds into ranked suspicion, compounds in value as DAU grows |

Everything is behind a kill switch, everything has a local fallback, and nothing Jev-related ever runs inside the table-actor action loop. Cost at launch scale is single-digit dollars per month (math in §6).

---

## 1. What Jev actually is (and isn't)

### 1.1 The primitives

One request = one `state` + N questions, evaluated **in parallel and in isolation** against the same state. Adding questions barely changes response time, and each question is evaluated independently, so there is no context-rot across questions.

| Primitive | Asks | Returns | StackBluff example |
|---|---|---|---|
| **Choice** | Pick one option from your list | `choice`, `probabilities{}`, `confidence` | "Which coaching frame fits this spot?" |
| **Score** | Rate against ordered, *descriptive* levels | `score`, `legend{}`, `probabilities{}`, `confidence` | "How story-worthy is this hand?" (0–4 levels you author) |
| **Noul** | Is this true? (yes-probability) | `noul` (0–1), **no confidence field** | "Is this transfer reciprocal within 48h of losing?" |

Three rules from the primitives docs that shape every call site below:

1. **Question IDs (`spot_type`, `is_urgent`, …) are for your code only — they are never sent to the model.** The complete meaning must live in `instructions`. An ID like `is_close_decision` with empty instructions is a bug.
2. **Reference state fields by backticked path** — `` `hero.equity_bucket` ``, `` `history.actions[3]` `` — instead of restating values. The model then knows exactly which part of the state each judgment is about.
3. **Noul has no `confidence` field — the probability *is* the signal.** A Noul near 0.5 means yes and no are equally likely, *not* "medium intensity". If you need a graded degree, that's a Score, not a Noul. Noul also accepts optional `criteria: {true, false}` descriptions when the yes/no boundary is subtle.

Batching is first-class: TypeSafe's own cookbook (13 questions over one document) measured **12.2× cheaper and 10.0× faster** than one-call-per-question, with no change in answers. This makes "speculative fan-out" — asking a few extra speculative questions just in case — economically rational.

### 1.2 The numbers that matter for StackBluff

| Property | Value | Implication for you |
|---|---|---|
| Endpoint | `POST https://api.typesafe.ai/v1/systemone` | Plain REST — callable from Rust with `reqwest`. **There is no Rust SDK** (Python + JS only); expect ~150 lines of client code |
| Price | **$42 per Btok input ($0.042 per Mtok); output tokens free** | ~1,000-token Oracle call ≈ **$0.000042**. This is 1–2 orders of magnitude below typical LLM input pricing |
| Rate limits | 250k tokens/sec · 1,200 requests/min (dynamic, may change) | You will not hit these at launch scale; still honor `retry-after` with backoff |
| Context | 64k per request; 32k for state + longest question | Effectively unlimited for poker spots — but see §1.3: *smaller state is better*, not just cheaper |
| Input | Text only (string / JSON object / array) | Cards, stacks, boards all serialized as text — fine. No images |
| Languages | English-primary; other languages measurably weaker | Your Lingui catalogs (en/fr/es) become the i18n shield: Jev picks a template *id*, your catalog renders localized text |
| Model versions | `jev-latest` → `jev-1.13.0`; `jev-preview` alias moves ahead on preview builds | **Pin `jev-1.13.0`** if you tune confidence thresholds; log `response.model` on every call; `GET /v1/models` lists what your account can send |
| Errors | `401` auth · `422` validation (body names the field) · `429` rate limit · `529` overloaded | Retry only 429/529, honoring `retry-after`, with exponential backoff. **422 is a request bug — alert, never retry; 401 trips the kill switch** |

### 1.3 Known failure modes (from TypeSafe's own "jaggedness" doc) — mapped to poker

TypeSafe publishes the known weaknesses of `jev-1.13`. These map directly onto design rules for StackBluff:

| Jev weakness | Rule for StackBluff |
|---|---|
| **Weak at math, counting, numeric precision** | Equity, pot odds, M-ratios, payout math stay in Rust (you already have `fast_equity`, `sb-game-engine::analytics`). Pass Jev *precomputed, named buckets*: `"equity": "0.30–0.40"`, `"pot_odds": "3.2:1"`, `"stack_class": "short (11–20bb)"` — never raw floats it must interpret |
| **Score levels are weakly numerically calibrated** | Use Score for *ordinal* judgments only (sizing tiers, story quality, frustration). Never interpolate the score to reconstruct a number |
| **Literal reading of instructions** | Write Choice criteria as exact conditions ("The player raised preflop and folded to one bet postflop"), not vibes ("was this passive?") |
| **Large state full of irrelevant detail hurts accuracy** | Send compact per-spot states (a serialized `HandAnalysisParams` + short action history), never a full hand-history dump |
| **Indirection / double negatives cost accuracy** | One question = one judgment. Decompose and compose in code (their "composite scoring" pattern) |
| **Cannot generate text** | The Oracle's `output_text` templates stay. Jev *selects*; your templates *speak*. This is also your GDPR/i18n story |

### 1.4 A sample request/response (what an integration actually looks like)

```json
POST /v1/systemone
Authorization: Bearer $TYPESAFE_API_KEY
{
  "model": "jev-1.13.0",
  "state": {
    "street": "turn",
    "board": "Ks 7d 4h 2c",
    "hero": { "position": "button", "stack_bb": "38.5", "hand": "Ah Qd",
              "equity_bucket": "0.45–0.55" },
    "history": { "actions": ["utg raises 2.5bb", "hero calls", "flop checked through",
                       "turn: utg bets 3/4 pot"] },
    "pot_odds": "2.3:1",
    "opponent_read": "folded to 3 of last 4 flops bets; one showdown win"
  },
  "questions": {
    "spot_type": {
      "type": "choice",
      "instructions": "Given `street`, `hero`, `history.actions` and `opponent_read`, which coaching frame best fits the hero's situation?",
      "criteria": {
        "turn_give_up":        "hero has little equity and should concede",
        "float_turn_pressure": "hero can call planning to take it away on river",
        "bluff_raise":         "raising is credible given the board and reads",
        "pot_odds_call":       "calling is justified primarily by pot odds",
        "bluff_catch":         "hero holds a marginal made hand against a bet"
      }
    },
    "aggression_fit": {
      "type": "score",
      "instructions": "Given `hero.equity_bucket`, `pot_odds` and `opponent_read`, how aggressive should the recommended line be?",
      "criteria": ["passive: pot control, check or call small", "standard: apply pressure with half-to-two-thirds pot", "maximum: go for stacks, pot-sized or larger"]
    },
    "is_marginal": {
      "type": "noul",
      "instructions": "Given `hero.equity_bucket` and `pot_odds`, is the decision close enough that pot odds, not card strength, should drive it?",
      "criteria": {
        "true": "equity is within roughly a bucket of the break-even threshold",
        "false": "the line is clearly forced by hand strength either way"
      }
    }
  }
}
```

The response — one typed answer per question, under the same IDs, plus token usage:

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "spot_type": {
      "type": "choice",
      "choice": "float_turn_pressure",
      "probabilities": { "turn_give_up": 0.11, "float_turn_pressure": 0.58,
                         "bluff_raise": 0.09, "pot_odds_call": 0.15, "bluff_catch": 0.07 },
      "confidence": 0.58
    },
    "aggression_fit": {
      "type": "score",
      "score": 1.4,
      "legend": { "0": "passive: pot control, check or call small",
                  "1": "standard: apply pressure with half-to-two-thirds pot",
                  "2": "maximum: go for stacks, pot-sized or larger" },
      "probabilities": { "0": 0.12, "1": 0.65, "2": 0.23 },
      "confidence": 0.63
    },
    "is_marginal": { "type": "noul", "noul": 0.72 }
  },
  "usage": { "input_tokens": 412, "output_tokens": 48 }
}
```

Your code branches on `answers["spot_type"].choice` like an enum — never a parsed string. Note the three answer shapes: Choice carries `choice` + `probabilities` + `confidence`; Score carries `score` (which can land *between* levels — 1.4 above) + `legend` + `probabilities` + `confidence`; Noul carries only `noul`. Score `probabilities` keys are the level indices as strings, matching `legend`.

---

## 2. Architectural fit in the modular monolith

### 2.1 New crate: `sb-typesafe`

Follow your existing hexagonal conventions:

```
backend/crates/sb-typesafe/
├── Cargo.toml          # reqwest, serde, tokio, tracing, metrics, sb-contracts
└── src/
    ├── lib.rs          # TypeSafeClient (reqwest), RetryPolicy, circuit breaker
    ├── types.rs        # Question (Choice/Score/Noul), SystemOneResponse, serde types
    └── service.rs      # JudgmentService impl
```

- **Trait in `sb-contracts`** (`JudgmentService: ask(state, questions) -> Result<Answers>`) so every call site stays `mockall`-testable — same pattern as `OracleService`, `MissionApi`, `AntiCheatService`.
- **Config via env:** `TYPESAFE_API_KEY`, `TYPESAFE_MODEL=jev-1.13.0` (pinned), `TYPESAFE_TIMEOUT_MS=800`, `TYPESAFE_ENABLED=false` (global kill switch), plus per-call-site flags (`ORACLE_JEV_ENABLED`, `BOT_JEV_ENABLED`, …) for staged rollout.
- **Error semantics (from the API reference):** retry `429`/`529` with exponential backoff honoring `retry-after` (the Python/JS SDKs do this by default — replicate it in ~150 lines of Rust); `422` means the request body failed validation (the body names the field) — that's a bug, fire an alert, never retry; `401` is a config error — alert and trip the kill switch so call sites stop paying the latency of doomed calls.
- **Failure semantics:** any error, timeout, or kill switch ⇒ call site falls back to the current heuristic path and increments `counter!("typesafe_fallback_total")`. Jev is an *enhancement layer*, never a dependency.
- **Do not ship the JS SDK in the PWA/Mini App.** The API key must never leave the backend; all Jev calls originate from `sb-server` / background jobs.

### 2.2 The hot-path rule

Your README promises a sub-10ms engine. Jev round-trips are network calls (expect tens to a few hundred ms — measure with a probe before enabling; the docs position Jev as orders-of-magnitude faster than LLMs but do not publish an SLA). Therefore:

**Nothing in the table-actor action loop ever awaits Jev.** There are exactly three legal insertion points, and all three already exist in the architecture:

1. **On-demand REST** — the Oracle (`POST /oracle/analyze`) is already user-initiated, quota-gated, and off the game loop.
2. **Inside the bot think window** — `sb-poker-bots/src/actor.rs` already sleeps `rng.random_range(500..2000ms)` before acting to look human. A Jev call with a hard 800 ms timeout and local fallback fits inside that budget *for free*.
3. **Background consumers** — `spawn_viral_observer` / `spawn_history_recorder` broadcast listeners and `sb-server` background jobs. Hand-completion events fan out to missions, referral tracking, replay cards; anti-cheat triage joins this fan-out.

### 2.3 GDPR & play-money posture

- **State contents:** cards, board, stacks, positions, action strings, pseudonymous UUIDs. **Never** send emails, usernames, device fingerprints, IPs, or chat text by default. IDs stay UUIDs; if you want extra safety, send a per-request salted hash instead of the raw `UserId`.
- TypeSafe documents that Jev is **not trained on customer requests**, offers a **DPA**, and **zero data retention (ZDR) for enterprise**. For EU users, review the DPA/SCCs before launch — this is a one-time legal task on a €100 budget, not an engineering one.
- Play-money means no financial records are involved; transfer amounts are game tokens. That keeps the anti-cheat use case in "low-risk pseudonymous telemetry" territory.
- The one feature that *would* send user free text is Telegram support triage (§6, D3) and any future chat-moderation feature — gate both behind explicit user consent and document it in your GDPR notice.

---

## 3. Integration area A — The Oracle (`sb-oracle`)

### Current state (from `sb-oracle/src/lib.rs`, `templates.rs`, `assets/templates.json`)

- `OracleServiceImpl::analyze()` receives `HandAnalysisParams` — hole cards, community cards, pot size, stack, `pot_odds_ratio`, `hand_strength`, position, `stack_bb`, `is_bluff_catching`, `is_cbet_situation`.
- `TemplateLibrary::select()` does **first-match-wins** scanning over ~30 static templates with threshold rules.
- Confidence is **hardcoded**: `0.85` when a template matches, `0.5` for the generic fallback.
- Monetization is already wired: 3 free analyses per 8h (`SessionManager`), unlimited with Season Pass (`has_active_season_pass`), `UPGRADE_URL` on `LimitReached`.

The Oracle is the highest-value, lowest-risk Jev target in the codebase — the response shape (`AnalysisResult { recommendation, confidence }`) literally already has a confidence field that is currently a fake constant.

### A1. Semantic spot classification (replace `select()`, keep the templates)

**What changes.** Keep `templates.json` and `Template::render()` exactly as they are (they are your i18n and tone-of-voice layer). Replace only the selection logic:

```rust
// sb-oracle/src/lib.rs — inside OracleServiceImpl::analyze, after the quota check
let answers = judgment.ask(
    serde_json::json!({
        "street": street_from(&params.community_cards),
        "hole_cards": params.hole_cards,
        "board": params.community_cards,
        "position": params.position,
        "hand_strength_bucket": bucket(params.hand_strength),   // "0.70–0.85"
        "pot_odds": format!("{:.1}:1", params.pot_odds_ratio),
        "stack_class": stack_class(params.stack_bb),            // "deep (>100bb)"
        "situation": {
            "is_bluff_catching": params.is_bluff_catching,
            "is_cbet_situation": params.is_cbet_situation,
        }
    }),
    questions! {
        "frame" => Choice {
            // instructions must carry the full question — the id is code-only
            instructions: "Given the hand state above, which coaching frame best fits this situation?",
            criteria: template_criteria_with_none(),
            // ^ generated from templates.json ids + names, PLUS a trailing
            //   "none_of_these": "no listed frame fits; the generic advice applies"
            //   option — the model can't pick a value you omitted, so give the
            //   no-match case an explicit home (per the primitives docs).
        },
        "difficulty" => Score {
            instructions: "How hard is this decision for a beginner?",
            criteria: ["obvious: one line dominates", "instructive: a common mistake exists here", "expert-only: beginners can't be blamed for either line"],
        },
        "is_close_decision" => Noul {
            instructions: "Are two or more lines defensible here?",
        },
    },
).await;
// match answers.frame.choice -> TemplateLibrary::by_id(choice).unwrap_or(current fallback)
// confidence = answers.frame.confidence  (real, calibrated)
```

**Why this is strictly better than first-match-wins:**

1. **No ordering artifacts.** Today `find()` returns the first template whose thresholds pass — `pot_odds_call` and `implied_odds_call` overlap on ranges, and which one the user sees depends on array order. Jev sees all candidates at once and returns a distribution.
2. **Real probabilities enable real UX.** `probabilities` across frames lets you show *top-2 candidate lines* ("mostly: float the turn; alternative: give up") — a coaching feature your template scan cannot produce.
3. **Confidence becomes honest.** Map `confidence` straight into `AnalysisResult.confidence`. Low confidence (< ~0.4) ⇒ return the current generic fallback text, which is the correct "I'm not sure" behavior for a coach. One nuance from the confidence docs: a *spread* distribution with two strong options is not failure — for a coach it's the honest answer "both lines are viable", so when `is_close_decision` is high, prefer surfacing top-2 frames over falling back (several genuinely acceptable alternatives legitimately flatten the distribution).
4. **"Is this close?" is a free upsell signal.** `is_close_decision` > 0.7 on a hand the user lost ⇒ perfect moment to show the replay-card / deep-analysis upsell. (`difficulty` is a speculative question — on turns where the frame answer already decides the flow, its uncertainty is simply ignored, which is the documented fan-out behavior.)

**Fallback:** any timeout/error ⇒ existing `select()` path. Zero user-visible regression.

**Cost:** state + 30-criteria Choice + 2 small questions ≈ 900–1,100 input tokens ⇒ **~$0.000045 per analysis**. Even 1M analyses/month (≈ 100k Season-Pass-grade power users analyzing 10 hands/day) is ~$42 — and the free tier (3 per 8h) caps anonymous cost far below that.

### A2. Skill-tiered coaching (new capability, nearly free)

Add 2–3 `output_text` variants per template id (`…_novice`, `…_intermediate`) to `templates.json`. Ask one extra Choice ("coach for which level?", criteria = `novice/intermediate/advanced`) keyed off the user's recent stats (hands played, win rate, previous Oracle usage — already in `user_statistics`). Same state, same call, one more question — batching economics mean the marginal question costs ~nothing. Your Lingui catalogs keep en/fr/es coherent because the *variant id* is what gets localized.

### A3. Free-text follow-up intents (later, after A1 proves out)

Today the Oracle only accepts the structured `HandAnalysisParams`. When you want "why not 3-bet?" style follow-ups, Jev routes them: Choice over `{sizing_question, range_question, odds_question, opponent_question, feature_request, abuse}` → route to the right template/FAQ/agent. Note Jev cannot *answer* the question in prose — pair it with a small LLM for generation later, with Jev as the cheap gate that decides when the expensive call is worth it (their "intent routing" pattern).

---

## 4. Integration area B — Poker bots (`sb-poker-bots`)

### Current state (from `engine.rs`, `actor.rs`, `evaluator.rs`)

- `decide(rng, profile, state, hole_cards, fast_equity)` is pure: equity > 0.7 ⇒ raise/call by `profile.aggression`; equity > pot_odds ⇒ call; else check/bluff-fold by `profile.bluff_frequency`.
- `fast_equity()` is the Rule-of-2-and-4 heuristic; `is_tilted` multiplies equity by 1.2.
- Raise sizing is **always `min_raise`** — bots never vary size.
- `BotActor::handle_action_required` delays 500–2000 ms (human-like) before acting.

Two honest problems: (1) the decision tree is exploitable and samey — bots put in exactly min-raise forever; (2) "personality" is 2 floats. `docs/brainstorm/gto-bot.md` already wants richer bots; Jev gives you a cheap middle path **before** any GTO/ONNX investment.

### B1. The hard-spot trigger — Jev only when the heuristic is uncertain

Do **not** send every bot action to Jev (wasteful and unnecessary). Compute the local signal first, and only escalate the genuinely ambiguous spots:

```rust
let margin = fast_equity - state.pot_odds;          // computed in Rust, always
let hard_spot = margin.abs() < 0.08                 // thin value / marginal bluff-catch
    || (state.street != "preflop" && facing_large_bet(state))
    || profile.jev_weighted;                        // persona flag, see B2

let decision = if !hard_spot || !typesafe_enabled() {
    decide(rng, profile, state, hole_cards, equity)  // today's path, unchanged
} else {
    jev_decide_or_fallback(profile, state, hole_cards, equity).await
};
```

`jev_decide_or_fallback` sends one batched call — Choice (`fold/check/call/raise`), Score for sizing with concretely-described levels (`"small: a third of pot or less, folds out the marginal hands" / "medium: half to two-thirds pot, gets value from worse" / "large: pot-sized or more, commits the stack"` — fixing the min-raise-only tell), and a Noul ("is a bluff credible given `state.history.actions`?") — with state built from **named buckets** (equity bucket, stack class, board texture in words like "two-tone, low, uncoordinated", action history as short strings, opponent lean like "folded to 3 of last 4 flop bets" produced by the existing stats aggregation). All three questions run in one request against the same state and are evaluated in parallel; the sizing Score is a speculative question the code reads only when the Choice lands on `raise`.

**Confidence-gated blend** (their confidence-routing pattern — thresholds are starting points to tune on your own hand archives, not constants):

| `confidence` | Behavior |
|---|---|
| < 0.45 | Discard, use local `decide()` |
| 0.45–0.60 | Blend: take Jev's line with probability `confidence`, else local |
| > 0.60 | Take Jev's line (sizing mapped from Score → chip amount by your sizing function) |

Two confidence nuances from the docs worth encoding: (1) for *harmless* bot choices, a spread distribution need not trigger fallback — two equally playable lines is information, and the blend band handles it naturally; (2) if the Choice came back `fold`/`check`, the sizing Score's uncertainty is simply ignored — uncertainty on an unused branch costs nothing.

**Latency:** fits inside the 500–2000 ms human delay. Implementation detail: start the Jev call *first*, keep the RNG sleep as the *minimum* wait (`tokio::join!(jev_call, sleep)`), and fall back local if the call loses the race.

**Cost (estimate, worst case all-bot tables):** ~500 tokens/decision × ~8 bot decisions/hand × 40 hands/h ≈ 160k tok/h/table ≈ $0.0067/h/table. A 24/7 all-bot practice table ≈ $4.8/mo. With the hard-spot trigger (Jev on ~20–30% of decisions) ≈ **$1–1.5/mo per always-on table**, and real mixed tables cost a fraction. At launch scale this is a rounding error on the €100 budget; add a Prometheus daily-token alarm anyway (§7).

**Eval harness before enabling (important):** replay ~1k archived `HandCompletedEvent`s through both paths (shadow mode: log Jev's answer vs. the bot's actual decision, act on neither), measure agreement + which line a GTO-aware reviewer prefers, *then* enable at 10% of tables.

### B2. Persona archetypes that mean something

Extend `BotProfile` from `{aggression, bluff_frequency}` to carry an archetype: `maniac`, `tag` (tight-aggressive), `grinder`, `calling_station`, `tricky`. Two layers:

- **Offline:** generate 20–30 named personas (the LLM-generated profile idea from `gto-bot.md` still applies) with per-archetype criterion *phrasing* for the Jev questions ("The player is a maniac: raise credible?" changes how the same state reads) plus margin thresholds (a maniac escalates on thinner margins).
- **Runtime:** `BotProfile` selection stays rule-based (per-table mix, bankroll tier from `BankrollManager`). Jev adds per-spot texture, not per-bot fine-tuning — remember Jev is not fine-tunable; personality lives in the criteria and your weights.

### B3. Table talk (future, gated by Jev)

Bots are currently silent. If you add chat, the *generation* must be an LLM (Jev can't write), but Jev is the perfect cheap gate for *when*: Noul("is this a natural moment for table talk given the action?") before spending an LLM token. Defer until there's a chat product at all.

---

## 5. Integration area C — Anti-cheat (`sb-anti-cheat`)

### Current state (from `service.rs`, `transfer_tracker.rs`, `ip_collusion.rs`)

- `TransferTracker`: blocks a from→to pair when 24h net exceeds `TRANSFER_LIMIT` (default 5000). Binary: pass or block.
- `IpCollusionTracker`: flags a pair after `HEADS_UP_LIMIT` (default 5) heads-up sessions from the same IP in 24h. Binary counter.
- `fingerprint_tracker`: flags shared device fingerprints — which also flags *legitimate* co-located players (couples, families, cafés).
- Everything lands in `anti_cheat_events` and metrics counters. There is no notion of "suspicious but not proven", no ranking, no review workflow.

The structural problem: **deterministic thresholds are either too strict (false positives → angry users, support load) or too loose (colluders stay under the limit by splitting transfers).** Jev doesn't replace the hard floor — it adds the graded judgment layer above it.

### C1. Transfer-laundering triage (async, on block + on near-miss)

**Trigger:** a transfer is blocked *or* crosses 70% of the limit (the near-miss band is where manual laundering lives today).

**What stays deterministic (in code, before Jev):** the hard block itself, and all the numeric features — reciprocity (did B transfer back within 48h of A busting?), amount clustering, timing regularity, table-overlap count, device/IP overlap flags. All of these are counts and comparisons — exactly what Jev is bad at. You compute them; Jev *interprets* them.

**The Jev call (one batched request):**

```json
{
  "state": {
    "pair": ["u-8f3", "u-2a1"],
    "transfer_summary": "4 transfers in 24h: 2000, 2000, 2000, 1800; recipient lost 3 buy-ins at u-8f3's table in the same window",
    "reciprocity": "none within 48h",
    "amount_pattern": "just under per-transfer limit, round amounts",
    "device_overlap": "1 shared fingerprint",
    "ip_overlap": "2 sessions same /24 subnet",
    "table_overlap": "6 heads-up hands in 7 days",
    "account_ages": "both < 2 weeks"
  },
  "questions": {
    "classification": { "type": "choice",
      "instructions": "What best explains this transfer pattern?",
      "criteria": {
        "friends_sharing":   "casual lending between acquaintances, irregular amounts",
        "bankroll_shipping": "one player funds another regularly, transparent pattern",
        "winnings_payout":   "looks like paying out a stake or debt, consistent with history",
        "laundering":        "transfers evade limits to fund collusion or sell chips",
        "collusion_funding": "transfers coincide with the two playing heads-up together"
      }},
    "same_person_likely": { "type": "noul",
      "instructions": "Do both accounts behave as controlled by the same person?" },
    "urgency": { "type": "score",
      "instructions": "How urgently should a human review this?",
      "criteria": ["routine, log only", "review within 24h", "review immediately"] }
  }
}
```

**Action policy (confidence-gated):**

| Outcome | Action |
|---|---|
| `laundering`/`collusion_funding` ∧ confidence ≥ 0.75 | Open review case in `anti_cheat_events` with the full payload; optionally freeze pending transfers of the pair (deterministic rule, not Jev's) |
| confidence 0.45–0.75 | Log + metric; queue for the nightly sweep (C2) |
| `friends_sharing`/`winnings_payout` ∧ confidence ≥ 0.6 | Attach a "benign, machine-reviewed" note — this is the false-positive killer |
| Anything else | Log only |

### C2. Nightly collusion sweep over flagged pairs

TypeSafe's parallel-questions cookbook is literally your nightly job: batch every question about one pair into a single call. Extend `spawn_history_recorder`-style wiring with a `spawn_anticheat_sweep` background job that consumes `HandCompletedEvent`-derived pair stats (heads-up frequency, all-in frequency between the pair, showdown folding patterns — i.e., "always folds the second nuts to each other") and produces a **ranked review queue** instead of a flat flag-at-5. One call per pair, ~1.5–2k tokens. 10k flagged pairs/night ≈ 20M tokens ≈ **$0.84/night worst case**; realistically far less because only pairs that pass deterministic pre-filters reach Jev.

### C3. Shared-fingerprint classification

The fingerprint tracker can't distinguish "couple sharing a tablet" from "one person with five accounts". Same pattern: Choice (`same_household_plausible / frequent_public_venue / multi_accounting_suspected`) + Noul("is multi-account use likely fraudulent?"), confidence-gated so public-venue false positives never trigger enforcement. Defer until fingerprint volume makes manual review impossible.

---

## 6. Integration area D — Engagement & ops

### D1. Personalized daily missions (`sb-mission`)

Today `select_daily_missions` is a seeded RNG draw of 3 from the pool — same distribution for a first-day novice and a 500-hand grinder. Upgrade: one Jev **Choice** per player per day, criteria = the mission pool entries, state = a short style summary computed in code (VPIP-ish flags already derivable from `HandResult`: raised preflop, went to showdown, went all-in; plus mission-completion history and streak status). Criteria phrasing carries the intent: "This player folds too much: pick missions that reward aggressive lines." Falls back to the RNG draw when disabled — the RNG path stays, so it's zero-risk. Cost: 1 call/user/day ≈ 600 tokens ⇒ 10k DAU ≈ 6M tok/day ≈ **$0.25/day**. Also a natural reroll-fee upsell: "reroll for missions that fit your style" (Season Pass perk).

### D2. Replay-card storyworthiness (`sb-viral` / `viral_observer`)

`ReplayCardObserver::on_significant_hand` fans out from every `HandCompletedEvent`. Add a Jev **Score** ("How story-worthy is this hand for sharing?": `routine / mildly interesting / dramatic / epic bad-beat-or-cooler`) + a **Noul** ("would a casual player find this shareable?") with state = the hand's action arc + outcome as text. Only generate/upload R2 assets for hands above threshold. Two wins: storage/CDN spend drops, and the feed (and future social share pages) only shows bangers. Fully async in the existing observer task. Cost: only *significant* hands get scored (you already gate on significance), so this is pennies.

### D3. Telegram support intent routing (`sb-bot-handler`)

`commands.rs` handles fixed commands; any free-text message to @StackBluffBot gets canned replies today. Insert the intent-routing pattern: Choice (`create_table / join_table / tournament_help / payment_issue / bug_report / abuse_report / other`) + Score (urgency) on free text → route to the existing handler functions, open a support case for `payment_issue`/`abuse_report`, or reply with localized FAQ. The 2s `SERVICE_TIMEOUT` discipline in `commands.rs` already matches Jev's timeout profile. **GDPR note:** this is the one flow where user free text leaves the server — require consent or run it only on admin-flagged messages initially.

### D4. Puzzle catalog QC (`sb-viral/src/puzzle`)

Offline batch: for each puzzle in `puzzles.json`, Score ("How hard is this puzzle actually?" vs. its stated difficulty) + Noul ("Is the stated solution defensible?"). A weekly cron that flags mislabeled or broken puzzles. Trivial cost, catches embarrassing content bugs before players do.

### D5. Churn-risk winback (notifications)

Nightly **Score** over per-user activity summaries ("hasn't played 9 days, was 3-day streak, missed 2 season-pass weeks") → route to `multi_channel` (Telegram/push/email per user preference) *only* for high-risk ∧ high-value users, confidence-gated ≥ 0.7 to protect deliverability. This is a composite-scoring exercise in code with Jev providing the judgment dim.

---

## 7. Impact / effort matrix

Scores: impact 1–5 on product/business value; effort 1–5 including tests + eval harness. "Latency risk" = chance of touching the player-perceived path.

| # | Idea | Area | Impact | Effort | Latency risk | Est. monthly cost @ 10k DAU | Verdict |
|---|---|---|---|---|---|---|---|
| A1 | Oracle semantic spot classification | Oracle | **5** | 2 | None (REST, quota-gated) | ~$5–45 (quota-bound) | ⭐ Do first |
| A2 | Skill-tiered coaching variants | Oracle | 4 | 1 | None | +~5% of A1 | ⭐ Bundle with A1 |
| B1 | Hard-spot bot judgment + sizing | Bots | **5** | 3 | Low (inside think window, fallback local) | ~$5–15 (sampled) | ⭐ Do second |
| B2 | Persona archetypes | Bots | 4 | 2 | Low | included in B1 | ⭐ Bundle with B1 |
| C1 | Transfer-laundering triage | Anti-cheat | 4 | 2 | None (async) | < $1 | ⭐ Do third |
| C2 | Nightly collusion sweep | Anti-cheat | 4 | 2 | None (async) | < $25 worst case | ⭐ Bundle with C1 |
| C3 | Fingerprint classification | Anti-cheat | 2 | 1 | None | negligible | Defer (needs volume) |
| D1 | Personalized missions | Engagement | 3 | 2 | None (daily batch) | ~$8 | Next |
| D2 | Replay-card storyworthiness | Viral | 3 | 1 | None (async) | pennies | Next |
| D3 | Telegram support routing | Ops | 3 | 1 | None (bot chat) | < $1 | After support volume exists |
| D4 | Puzzle QC | Ops | 2 | 1 | None (offline) | negligible | Nice-to-have |
| D5 | Churn-risk winback | Ops | 3 | 2 | None (nightly) | ~$2 | After D1 |
| A3 | Oracle follow-up intents | Oracle | 3 | 3 | None | usage-bound | After A1 + an LLM companion |
| B3 | Bot table-talk gating | Bots | 2 | 3 | None (gates an LLM) | — | Defer (needs chat product) |

---

## 8. Constraint math (the €100 / sub-10ms / GDPR triangle)

### 8.1 Budget

At $0.042/Mtok input with output free, the realistic monthly bill at **launch scale** (~500 DAU, of which ~50 active on a given evening, ~10 mixed tables, ~2 all-bot practice tables — roughly 20× cheaper than the 10k-DAU column in §7):

| Feature | Assumption | Tokens/month | Cost/month |
|---|---|---|---|
| Oracle A1/A2 | 30 analyses/day avg (quota-capped) × 1k tok | ~0.9M | **~$0.04** |
| Bots B1 | 2 all-bot tables × 12h × sampled 25% of ~1.6M tok/h/table | ~290M worst → sampled ~72M | **~$0.9–3.0** |
| Anti-cheat C1+C2 | 300 triage/sweep calls/day × 2k tok | ~18M | **~$0.75** |
| D1+D2+D5 batches | 500 DAU × ~0.7k tok/day + replay QC | ~11M | **~$0.45** |
| **Total** | | | **≈ $1.5–4.5/month** |

Even the pathological case (every bot decision unsampled, 50 all-bot tables) lands around $350/mo — which is why the hard-spot trigger + sampling + a daily token alarm are non-negotiable guardrails, not nice-to-haves. Note TypeSafe warns rate limits are dynamic while demand is high; the SDK-style retry/backoff in `sb-typesafe` covers you.

### 8.2 Latency

- Game loop untouched: table actors, betting timers, and the WS fan-out never await Jev.
- Bot path: Jev runs concurrently with the existing 500–2000 ms human delay; 800 ms hard timeout; local `decide()` fallback. Worst case = today's behavior.
- Oracle: user-initiated REST, quota-gated; a slow response degrades to the template path.
- Anti-cheat & engagement: fully async background jobs.
- Recommendation: run a latency probe (10 cold calls/min for a day) before rollout and set `TYPESAFE_TIMEOUT_MS` at p95 + 200 ms.

### 8.3 GDPR / play-money

- State = pseudonymous game data only (UUIDs, cards, chips, action strings). No PII, no fingerprints, no IPs, no free text by default. Anti-cheat states use aggregate summaries computed in Rust, not raw records.
- TypeSafe: not trained on customer data; DPA available; ZDR on enterprise. Review DPA once before EU launch.
- Only D3 (support triage) and any future chat-moderation feature transmit user free text — both get explicit consent gating.
- Play-money chips = game tokens, not financial instruments; no payment data flows to Jev (Stripe stays Stripe).

---

## 9. Guardrails checklist (steal this for the PR description)

- [ ] Pin `model: "jev-1.13.0"`; log `response.model` with every answer (correlation IDs already flow through your logging stack)
- [ ] Global kill switch + per-call-site flags; all default **off** at merge
- [ ] Every call site has a synchronous local fallback; fallback increments `typesafe_fallback_total`
- [ ] Confidence gates per risk: anti-cheat enforcement ≥ 0.75; bot line-taking 0.45–0.60 blend; Oracle display ≥ 0.4
- [ ] Numbers never sent raw — named buckets only; never interpolate Score values
- [ ] Choice criteria written as exact literal conditions (jaggedness #1); one judgment per question; open-ended Choices get an explicit `none_of_these` option
- [ ] Instructions carry the complete question (IDs are code-only) and reference state by backticked paths (`hero.equity_bucket`)
- [ ] Independent questions batched into one request; a second request only when code must fetch evidence or build new state first
- [ ] Noul 0.45–0.55 treated as "no signal" (not medium intensity); uncertainty on unused speculative branches ignored, never acted on
- [ ] Shadow-mode eval on ~1k archived hands before enabling bots/Oracle (log-only, no acting)
- [ ] Prometheus: `typesafe_tokens_total` (from `usage.input_tokens`) with a daily-budget alert; `typesafe_latency_seconds` histogram
- [ ] Secrets via env (`TYPESAFE_API_KEY`), never in the frontend bundle
- [ ] Retry only 429/529 with backoff honoring `retry-after`; 422 alerts (request bug, never retried); 401 trips the kill switch

---

## 10. If you greenlight: build order

1. **Week 1 — `sb-typesafe` crate + probe.** Client, retries, circuit breaker, metrics, kill switch. A one-endpoint latency probe job. No feature code yet.
2. **Week 2 — Oracle A1+A2 behind `ORACLE_JEV_ENABLED`.** Eval vs. template outputs on archived params; ship dark; enable; watch `typesafe_fallback_total` and user-facing confidence distribution.
3. **Week 3–4 — Bots B1 in shadow mode.** Log Jev-vs-bot decisions on live tables without acting; review disagreements; enable at 10% of tables; extend sizing (fixes min-raise tell); bundle B2 personas.
4. **Week 5 — Anti-cheat C1 (triage on block/near-miss) + C2 nightly sweep.** Admin-facing ranked queue can start as a simple metrics log + `anti_cheat_events` rows.
5. **Later, per demand:** D1/D2/D5 batches (a single afternoon each once the crate exists), D3 when support volume justifies it, C3/B3 when their prerequisites exist.

---

## Sources

- TypeSafe agent skill: installed per [github.com/typesafe-ai/skills](https://github.com/typesafe-ai/skills) (`SKILL.md`); its doc index [docs.typesafe.ai/llms.txt](https://docs.typesafe.ai/llms.txt) used for discovery
- TypeSafe AI docs: [introduction](https://docs.typesafe.ai/introduction), [System One](https://docs.typesafe.ai/concepts/system-one), [state](https://docs.typesafe.ai/concepts/state), [primitives](https://docs.typesafe.ai/primitives), [confidence](https://docs.typesafe.ai/confidence), [models & pricing](https://docs.typesafe.ai/models), [API](https://docs.typesafe.ai/api), [how to build](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [patterns](https://docs.typesafe.ai/patterns) (fan-out, confidence routing, composite scoring, intent routing), [parallel-questions cookbook](https://docs.typesafe.ai/cookbooks/parallel_questions), [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
- StackBluff dump: `backend/crates/sb-oracle/src/{lib,session,templates}.rs` + `assets/templates.json`; `sb-poker-bots/src/{actor,engine,evaluator,economy}.rs`; `sb-anti-cheat/src/{service,transfer_tracker,ip_collusion,rate_limiter}.rs`; `sb-mission/src/service.rs`; `sb-viral` observer wiring (`sb-server/src/viral_observer.rs`); `sb-bot-handler/src/commands.rs`; `sb-contracts/src/async_hooks.rs`; `sb-table-registry/src/events.rs`; `sb-ws-messages` `AnalyticsPayload`; `docs/brainstorm/gto-bot.md`
- All costs are estimates from the published $42/Btok input price; token counts assume compact per-spot states as sketched above. Re-estimate after the Week-1 probe with real `usage` data.



