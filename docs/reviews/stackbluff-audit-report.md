# StackBluff — Deep-Dive Codebase Audit Report

**Repository:** `elcoosp/stackbluff` (Rust/Axum backend + React PWA + Telegram Mini App poker platform)
**Audit date:** 2026-10-04 · **Codebase:** ~34.7k LOC Rust (21 crates) + ~37.9k LOC TypeScript (3 frontend workspaces)
**Method:** Full manual read of the game engine, table actor, WS protocol, auth, payments, tournament directors, DB repos and writer loop; 4 parallel subsystem sweeps (frontend PWA, tournament/club/mission backend, db/server/rest, mini-app/auth/payment); **every critical finding below was re-verified against the source line-by-line** before inclusion.

---

## 0. Executive Summary

StackBluff is an ambitious, well-organized monorepo with genuinely good bones: clean crate boundaries, a strong type system (`ChipAmount`, strong IDs), CSPRNG deck shuffling, WS auth *before* upgrade, savepoint-based DB batching, and several well-written subsystems. However, the audit found **102 distinct defects**, including a cluster of game-integrity and economy bugs that are severe enough to make the platform unshippable in its current state:

| Severity | Count | Highlights |
|---|---|---|
| 🔴 **Critical** | 24 | Folded players' chips destroyed at every multiway showdown · betting state corrupts on partial all-in raises · kick-vote credits victim's stack to the attacker · tournament buy-ins never debited (infinite chip faucet) · payment webhooks never mounted (users pay, chips never arrive) · 100× price bug · spoofable GDPR identity · dead rate limiter · registry deadlock |
| 🟠 **High** | 33 | MTT payouts computed from wrong player count · directors react to *all* tables' events (cash busts eliminate tournament players) · Telegram initData replayable forever · JWT survives password reset · Stripe double-credit on webhook retry · mini-app is fundamentally incompatible with the current store/protocol · several frontend flows call endpoints that don't exist |
| 🟡 **Medium** | 35 | Wrong pot-odds math (÷10 fudge) in both bot and player analytics · antes announced but never collected · 10 Hz full-tree React re-renders · unbounded writer channel · hand-history full scans with no LIMIT · CORS blocks DELETE · public `/metrics` |
| ⚪ **Low** | 10 | Hardcoded 30s timers, nil table IDs in snapshots, redirect param ignored, minor leaks |

**Thematic root causes:**

1. **Economy invariants are enforced nowhere.** Chip movements happen through non-atomic, non-transactional, sometimes *unwired* paths. There is no ledger; several flows mint or destroy chips.
2. **Poker-rule edge cases in the betting engine** (partial all-in raises, odd chips, dead money) are wrong — the most-tested code in the repo is the least correct where it matters most.
3. **Wiring gaps:** fully-implemented features exist but were never connected (payment webhooks, notification service, anti-cheat engine, `remove_actor`, `count_registrations`), while other code calls endpoints that were never written.
4. **Divergent duplicates:** the mini-app, the PWA, and the shared package contain three divergent copies of the WS/game logic; two club-WS clients and two notification services disagree with each other.

All findings include file paths and line numbers valid as of commit `21b7a009` ("chore: docs jev"), a concrete failure scenario, and a code-level fix.

---

## 1. How to Read This Report

Each finding is formatted as:

> **[ID] Title** — `severity` · `subsystem`
> **Files:** path:lines
> **What's wrong / Failure scenario / Fix (code)**

IDs are stable and grouped: `E-` game engine, `T-` tournament, `B-` backend services/DB, `S-` security, `P-` payments, `F-` frontend PWA/shared, `M-` mini-app, `X-` performance, `I-` incomplete/dead features, `L-` low.

**Severity definitions used:**
- **Critical** — loss/theft/minting of chips or money, crash of a core actor, deadlock, or full compromise of an auth boundary.
- **High** — broken user-facing feature, wrong game outcome, or exploitable-but-bounded abuse.
- **Medium** — incorrect behavior with workaround, perf degradation, or defense-in-depth gap.
- **Low** — correctness/quality issue with no immediate user impact.

---

## 2. Architecture Quick Map (for orienting the fixes)

```text
Client (PWA / Mini-App)
  │  REST /api/* (JWT)          WS /ws/game?token= (JWT checked pre-upgrade)
  ▼
sb-server (main.rs) ── merges: rest_router, ws_router, auth, bot handler, oracle,
  │                    hand archive, anti-cheat, tournaments, season cards, clubs,
  │                    missions, notifications, analytics
  ▼
sb-ws-handler ────► sb-table-registry (rooms map) ──► TableActor (per-room tokio task)
  │                        │                             │  owns sb-game-engine::GameState
  │                        │ broadcast bus               ▼
  │                        └──────────────► RoomMessage (TableState, ActionRequired, …)
  ▼
sb-db-repos (SeaORM/SQLite) ◄── DbCommand channel ── writer_loop (single writer, 100ms batch)
sb-tournament (SitGo/Mtt directors subscribe to the registry's global broadcast bus)
sb-payment (Stripe checkout + webhooks), sb-auth (JWT, email, Telegram initData), sb-club,
sb-mission, sb-viral, sb-oracle, sb-notification, sb-anti-cheat, sb-poker-bots, sb-bot-handler
```

Three facts that explain many bugs below:
1. `HandCompleted` events flow through **one global broadcast channel** that every tournament director subscribes to (no per-table filtering).
2. All DB writes funnel through a **single writer task**; some hot paths bypass or pre-date it.
3. Chip balances live in `users.chip_balance`; seat stacks live **only in the actor's memory**, reconciled via one-shot refund channels that can time out.

---

## 3. 🔴 Critical Findings

---

### [E-1] Side pots ignore folded players' dead money — chips destroyed at every multiway showdown

**Severity:** 🔴 Critical · **Subsystem:** game engine / chip conservation
**Files:** `backend/crates/sb-game-engine/src/game_state.rs:762-785` (builds `total_bets` from non-folded players only), `backend/crates/sb-game-engine/src/pot.rs:12-43`, `backend/crates/sb-table-registry/src/actor.rs:1913-1933` (`process_winners` credits exactly the side-pot amounts)

**What's wrong:**
`calculate_pot_winners()` computes side pots from **only the non-folded players'** `total_bet`:

```rust
// game_state.rs:781-785
let total_bets: Vec<(PlayerId, ChipAmount)> = active        // active = !has_folded
    .iter()
    .map(|&i| (self.players[i].player_id, self.players[i].total_bet))
    .collect();
let pots = compute_side_pots(&total_bets);
```

But `self.pot` (the real pot, incremented in `add_bet`, game_state.rs:393) includes every folder's contributions. The actor then credits each winner exactly `winner.amount` (actor.rs:1928-1931) — i.e. **only the side-pot total computed from non-folded bets** — while the UI is broadcast the full pot (`pot: total_pot`, actor.rs:1953-1957).

**Failure scenario (happens in virtually every orbit):**
3 players each put 100 in the pot; A folds on the river; B and C go to showdown. Pot = 300. Side pots computed from `[(B,100),(C,100)]` = one 200-chip pot. The winner is credited **200**. **A's 100 chips vanish from the economy.** Only the `active.len() == 1` path (winner takes `self.pot` wholesale) is correct.

**Fix — compute side pots from *all* money in, eligibility from non-folded:**

```rust
// game_state.rs — replace the total_bets construction inside calculate_pot_winners
pub fn calculate_pot_winners(&self) -> Vec<Winner> {
    if !self.hand_complete { return vec![]; }

    let active: Vec<usize> = self.players.iter().enumerate()
        .filter(|(_, p)| !p.has_folded)
        .map(|(i, _)| i)
        .collect();
    if active.is_empty() { return vec![]; }

    // Uncalled-bet return is handled separately (see E-1b); first: everyone's money
    let all_bets: Vec<(PlayerId, ChipAmount)> = self.players.iter()
        .filter(|p| p.total_bet > ChipAmount::new(0).unwrap())
        .map(|p| (p.player_id, p.total_bet))
        .collect();
    let folded: HashSet<PlayerId> = self.players.iter()
        .filter(|p| p.has_folded)
        .map(|p| p.player_id).collect();

    let pots = compute_side_pots_with_dead_money(&all_bets, &folded);
    // … remainder of the function unchanged, except splitting (see E-3)
}
```

```rust
// pot.rs — new: pots sized by every contributor, eligibility excludes folders
pub fn compute_side_pots_with_dead_money(
    players: &[(PlayerId, ChipAmount)],
    folded: &HashSet<PlayerId>,
) -> Vec<Pot> {
    let mut sorted: Vec<(PlayerId, i64)> =
        players.iter().map(|(p, a)| (*p, a.as_i64())).collect();
    sorted.sort_by_key(|(_, bet)| *bet);

    let mut pots = Vec::new();
    let mut last_bet = 0i64;
    let mut remaining = sorted;

    while !remaining.is_empty() {
        let min_bet = remaining[0].1;
        let contribution = min_bet - last_bet;
        if contribution > 0 {
            // money at this level = contribution × ALL contributors at ≥ this level
            let pot_amount = ChipAmount::new(contribution * remaining.len() as i64)
                .expect("positive");
            let eligible: Vec<PlayerId> = remaining.iter()
                .map(|(p, _)| *p)
                .filter(|p| !folded.contains(p))     // ← folders fund the pot, can't win it
                .collect();
            // A level funded solely by folded money rolls into the next pot.
            if !eligible.is_empty() {
                pots.push(Pot { amount: pot_amount, eligible_players: eligible });
            } else if let Some(prev) = pots.last_mut() {
                prev.amount = prev.amount.checked_add(pot_amount).expect("pot overflow");
            }
        }
        last_bet = min_bet;
        remaining.retain(|(_, bet)| *bet > min_bet);
    }
    pots
}
```

Add a regression test:

```rust
#[test]
fn dead_money_of_folder_is_distributed() {
    // B and C bet 100 each; A folded after contributing 100 → winner must get 300
    let players = vec![
        (pid(1), ChipAmount::new(1000).unwrap()), // A
        (pid(2), ChipAmount::new(1000).unwrap()), // B
        (pid(3), ChipAmount::new(1000).unwrap()), // C
    ];
    let mut s = GameState::new_hand(TableId::generate(), players, 0,
        (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap())).unwrap();
    // ... drive A to fold after putting 100 total in, B/C to showdown ...
    let winners = s.calculate_pot_winners();
    assert_eq!(winners.iter().map(|w| w.amount.as_i64()).sum::<i64>(), s.current_pot().as_i64());
}
```

> **E-1b (related, same lines):** uncalled bets are also never returned. If B bets 500 and everyone folds except C who is all-in for 100, C's pot is 200 (2×100) but B's extra 400 sits in `self.pot` and, on a B win via the `active.len() == 1` path, is paid to B (fine), but on a C win the side-pot math credits C 200 while B's uncalled 400 is distributed as if it were matched — returning chips B never should have risked. The standard fix is to return each player's uncalled excess before showdown: for each player, `excess = total_bet − max(other total_bets, 0)`; if `excess > 0`, credit it back and reduce the pot before computing side pots.

---

### [E-2] Partial all-in raise corrupts the betting state (negative `to_call`, shrunk `min_raise`, wrongly reopened action)

**Severity:** 🔴 Critical · **Subsystem:** game engine / betting rules
**Files:** `backend/crates/sb-game-engine/src/game_state.rs:347-382` (`Action::Raise`), `:609-620` (`current_call_amount`), `:675-728` (`action_required_for_current_player` broadcasts the corrupted state), `backend/crates/sb-shared-types/src/chips.rs:21` (`derive_more::Sub` allows negative `ChipAmount`)

**What's wrong:** On `Action::Raise(raise_amount)` the code does:

```rust
// game_state.rs:347-364
let total_bet = self.round_bets[idx] + raise_amount;
let required = self.smallest_bet + self.min_raise;
if total_bet < required && self.players[idx].stack != raise_amount {
    return Err(ActionError::InvalidRaise { .. });        // partial all-in is exempt — OK
}
...
self.add_bet(idx, raise_amount);
self.smallest_bet = total_bet;      // ← UNCONDITIONAL: can go DOWN
self.min_raise = raise_amount;      // ← UNCONDITIONAL: even on a partial raise
self.last_aggressor_index = Some(idx);
for (i, p) in self.players.iter_mut().enumerate() {   // ← reopens action for everyone
    if i != idx && !p.has_folded && !p.is_all_in { p.acted_this_round = false; }
}
```

Three rule violations in one branch:
1. **`smallest_bet` can decrease.** An all-in raise that lands below the current bet *sets the current bet level backwards*. The repo's own test `test_all_in_raise_below_minimum_is_allowed` (game_state.rs:1106-1126) creates exactly this state: blinds 5/10, P1 calls (10), P2 raises 100 (total 110), P1 all-in raises 40 (total 50) → `smallest_bet = 50`, below P2's 110.
2. **Negative `to_call` is broadcast.** `action_required_for_current_player` computes `to_call = smallest_bet − bet_this_round` = 50 − 110 = **−60** (plain i64 `Sub` via `derive_more`, no guard). The client receives `ActionRequired { to_call: -60, can_check: false }`. From here P2 cannot Check (`round_bets != smallest_bet` → `CannotCheck` with a negative `to_call` in the error) and cannot Call (call amount ≤ 0 → `InvalidRaise`) — the only legal move is "raise ≥ 1", and the hand is in an undefined state until a timeout force-folds someone.
3. **A sub-minimum all-in raise reopens betting** for players who already acted. Under Texas Hold'em rules (RR standard), a raise smaller than the previous full raise does **not** reopen action to players who have already called, and it must not lower the raise requirement.

**Fix:**

```rust
Action::Raise(raise_amount) => {
    let total_bet = self.round_bets[idx] + raise_amount;
    let is_all_in = raise_amount == self.players[idx].stack;
    let required = self.smallest_bet + self.min_raise;

    // A raise must at least match the previous bet + last full raise,
    // unless it is an all-in for less (allowed, but with restricted effects).
    if total_bet < required && !is_all_in {
        return Err(ActionError::InvalidRaise {
            attempted: raise_amount, min: self.min_raise,
        });
    }
    if self.players[idx].stack < raise_amount {
        return Err(ActionError::InsufficientStack {
            action: "raise".into(), needed: raise_amount,
        });
    }
    self.add_bet(idx, raise_amount);

    if total_bet > self.smallest_bet {
        let raise_size = total_bet - self.smallest_bet;   // size of THIS raise
        self.smallest_bet = total_bet;
        let full_raise = raise_size >= self.min_raise;
        if full_raise {
            self.min_raise = raise_size;                  // only full raises update the increment
            self.last_aggressor_index = Some(idx);
        }
        // Re-open action ONLY for a full raise (or for players who have not yet acted)
        for (i, p) in self.players.iter_mut().enumerate() {
            if i != idx && !p.has_folded && !p.is_all_in {
                let already_acted = p.acted_this_round;
                if full_raise || !already_acted {
                    // full raise: everyone acts again;
                    // partial all-in: only players still owing action stay pending
                    p.acted_this_round = false;
                }
            }
        }
    }

    if self.current_round == BettingRound::Preflop {
        self.raised_preflop.insert(player_id);
    }
    self.players[idx].acted_this_round = true;
    self.advance_turn();
}
```

And harden every `to_call` computation against the negative case (belt-and-braces, also protects the client):

```rust
// game_state.rs — action_required_for_current_player
let to_call = self.smallest_bet
    .checked_sub(self.players[current_idx].bet_this_round)
    .unwrap_or_else(|| ChipAmount::new(0).unwrap());   // never negative
```

Add a regression test that plays P2's response after the partial all-in:

```rust
#[test]
fn partial_allin_does_not_lower_bet_level_or_reopen_action() {
    // blinds 5/10, P1 stack 50: call, P2 raise to 110, P1 all-in to 50
    // → P2's to_call must remain 0 (he is already the highest bet),
    //   min_raise must remain 100, and hand must run out.
    ...
    assert_eq!(state.current_call_amount().as_i64(), 0);
    assert_eq!(state.min_raise_amount().as_i64(), 100);
}
```

---

### [E-3] Split pots destroy the odd chip(s)

**Severity:** 🔴 Critical (chip conservation) · **Subsystem:** game engine
**Files:** `backend/crates/sb-game-engine/src/game_state.rs:840-848`

**What's wrong:**

```rust
let share_val = pot.amount.as_i64() / best_indices.len() as i64;
let share = ChipAmount::new(share_val).expect("share positive");
for idx in best_indices {
    winners.push(Winner { player_id: self.players[idx].player_id, amount: share, .. });
}
```

Floor division with no remainder distribution. A 101-chip pot split two ways credits 50 + 50 = 100 — **1 chip silently destroyed**; 3-way splits destroy up to 2 chips per pot, compounding across side pots. Real poker assigns the odd chip(s) by position (first seat left of the button, then onward).

**Fix:**

```rust
let n = best_indices.len() as i64;
let share_val = pot.amount.as_i64() / n;
let remainder = pot.amount.as_i64() % n;

// Order winners by seat position relative to the button (left of dealer first)
let mut ordered: Vec<usize> = best_indices.clone();
ordered.sort_by_key(|&idx| {
    (idx + self.players.len() - self.dealer_index - 1) % self.players.len()
});

for (k, &idx) in ordered.iter().enumerate() {
    let extra = if (k as i64) < remainder { 1 } else { 0 };
    winners.push(Winner {
        player_id: self.players[idx].player_id,
        amount: ChipAmount::new(share_val + extra).expect("share positive"),
        hand_rank: best_strength.as_ref().unwrap().rank,
    });
}
```

---

### [B-1] Kick-vote refund credits the **victim's stack to the initiator** — direct chip theft

**Severity:** 🔴 Critical · **Subsystem:** WS handler / table actor
**Files:** `backend/crates/sb-ws-handler/src/lib.rs:771-799`, `backend/crates/sb-table-registry/src/actor.rs:2462-2473` (`finalize_kick_vote`)

**What's wrong:** When a kick vote passes, the actor sends the removed player's remaining stack through a oneshot channel. The WS handler created that channel in the **initiator's** message scope and credits whatever arrives to `user_id` — the initiator:

```rust
// ws-handler/lib.rs:771-788
let (refund_tx, refund_rx) = tokio::sync::oneshot::channel::<ChipAmount>();
match state.registry.start_kick_vote(room_id, *user_id, target_id, Some(refund_tx)).await {
    Ok(()) => {
        let user_id = *user_id;                       // ← INITIATOR
        tokio::spawn(async move {
            if let Ok(refund) = refund_rx.await && refund > ChipAmount::new(0).unwrap() {
                let ctx = RequestContext::new(Uuid::new_v4(), Some(user_id));
                if let Ok(new_balance) = user_repo
                    .update_chip_balance(ctx, user_id, refund.as_i64()).await  // ← thief's wallet
```

The actor side sends the *target's* stack:

```rust
// actor.rs finalize_kick_vote
let refund_responder = self.kick_refund_responder.take();
...
self.leave_player(state.target, tx, true).await;
...
if let Some(rt) = refund_responder { let _ = rt.send(stack); }   // target's stack
```

**Failure scenario:** The kicked player's seat stack is deposited into the voter's wallet; the victim receives nothing. Two colluders can farm this indefinitely (A sits down, B initiates and passes a kick vote, A's stack lands in B's balance, repeat).

**Fix:** Do the credit inside the actor/registry where the target is known, exactly like `leave_table` does, and delete the oneshot from the WS layer:

```rust
// actor.rs — finalize_kick_vote (replace refund responder plumbing)
if let Some(target_player) = self.players.get(&state.target).map(|p| p.stack) {
    let ctx = RequestContext::new(Uuid::new_v4(), Some(state.target));
    if let Err(e) = self.db.update_chip_balance(ctx, state.target, target_player.as_i64()).await {
        error!(%e, "kick refund: failed to credit target");
        // queue for retry / outbox — never drop a refund
    }
}
self.leave_player(state.target, tx, true).await;
```

```rust
// ws-handler/lib.rs — kick_vote_start: no refund channel at all
match state.registry.start_kick_vote(room_id, *user_id, target_id).await { ... }
```

---

### [B-2] `Registry::unsubscribe_from_room` deadlocks on the global room map

**Severity:** 🔴 Critical · **Subsystem:** table registry
**Files:** `backend/crates/sb-table-registry/src/registry.rs:718-725`

**What's wrong:**

```rust
pub async fn unsubscribe_from_room(&self, room_id: TableId, user_id: UserId) {
    if let Some(set) = self.user_room_map.write().await.get_mut(&user_id) {  // guard #1 held
        set.remove(&room_id);
        if set.is_empty() {
            self.user_room_map.write().await.remove(&user_id);   // ← second write on same lock
        }
    }
}
```

`tokio::sync::RwLock` is **not reentrant**. The first guard is still alive when the second `.write().await` runs → the task waits forever **while holding the map's write lock**. Every other operation that touches `user_room_map` (`join_room_full`, `find_all_user_rooms`, other unsubscribes) then stalls → server-wide join/reconnect freeze.

**Trigger path:** WS `reconnect` handling (`sb-ws-handler/src/lib.rs:292-297`) calls this whenever the *last* of a user's rooms fails to rejoin — i.e., a single reconnect after a room was reaped wedges the registry.

**Fix:**

```rust
pub async fn unsubscribe_from_room(&self, room_id: TableId, user_id: UserId) {
    let mut map = self.user_room_map.write().await;   // ONE acquisition
    if let Some(set) = map.get_mut(&user_id) {
        set.remove(&room_id);
        if set.is_empty() {
            map.remove(&user_id);
        }
    }
}
```

(Or migrate `user_room_map` to `DashMap`, which the workspace already depends on — `DashMap::remove_if` makes this trivially atomic.)

---

### [B-3] Tournament buy-ins are never debited — registration, prizes and crash-refunds mint chips from nothing

**Severity:** 🔴 Critical · **Subsystem:** tournament economy
**Files:**
- `backend/crates/sb-tournament/src/sit_go_tournament.rs:206-251` (`register_player` — pure bookkeeping),
- `backend/crates/sb-tournament/src/mtt_director.rs:239-284` (same),
- `backend/crates/sb-rest-router/src/tournament_routes.rs:174-198` (HTTP entry — no debit, no auth identity),
- `backend/crates/sb-tournament/src/crash_recovery.rs:41-65` (refunds a buy-in that was never charged),
- unused transactional APIs that were *designed* for this: `backend/crates/sb-contracts/src/tournament_api.rs:167-236` (`register_player_txn`, `increment_prize_pool`)

**What's wrong:**

```rust
// sit_go_tournament.rs:219-225 — the whole "charge"
self.players.push(RegisteredPlayer { user_id, player_id, buy_in });
self.player_info.insert(user_id, player_id);
self.prize_pool = ChipAmount::new(self.prize_pool.as_i64() + buy_in.as_i64()).unwrap();
```

No `user_repo.update_chip_balance(−buy_in)` exists on any tournament path. Meanwhile the end-of-tournament payout credits winners:

```rust
// sit_go_tournament.rs:509-511 / mtt_director.rs:743-745
user_repo.update_chip_balance(ctx, winner.user_id, prize.as_i64()).await
```

And `crash_recovery.rs:42-44` refunds every registrant of a crashed tournament:

```rust
user_repo.update_chip_balance(ctx.clone(), reg.user_id, tournament.config.buy_in.as_i64()).await
```

**Failure scenario:** Any user registers (free) → gets a full tournament stack → winner receives the prize pool minted into existence. If the server restarts mid-tournament, **every** registrant is credited a buy-in they never paid. Infinite faucet, and the in-memory `prize_pool` diverges from reality on every restart.

**Fix — transactional registration at the service boundary:**

```rust
// sb-tournament/src/tournament_service.rs
pub async fn register(&self, ctx: &RequestContext, tournament_id: TournamentId, user_id: UserId) -> Result<...> {
    let config = self.repo.get_config(tournament_id).await?;
    let actor_tx = self.get_actor_tx(tournament_id)?;

    // 1) Atomically debit + reserve: fails if balance insufficient
    let debited = self.user_repo.try_debit_chips(ctx, user_id, config.buy_in.as_i64()).await?;
    if !debited { return Err(AppError::InsufficientChips); }

    // 2) Ask the actor (authoritative duplicate check + capacity)
    let (rtx, r) = oneshot::channel();
    actor_tx.send(SitGoCommand::Register { user_id, respond_to: rtx }).await
        .map_err(|_| AppError::Internal("actor gone".into()))?;
    if let Err(e) = r.await.map_err(|_| AppError::Internal("actor dropped"))? {
        // 3) Compensate on rejection
        let _ = self.user_repo.update_chip_balance(ctx.clone(), user_id, config.buy_in.as_i64()).await;
        return Err(e);
    }

    // 4) Persist registration + prize pool inside one txn
    if let Some(repo) = &self.tournament_repo {
        if let Err(e) = repo.register_player_txn(tournament_id, user_id, config.buy_in).await {
            let _ = self.user_repo.update_chip_balance(ctx.clone(), user_id, config.buy_in.as_i64()).await;
            let _ = actor_tx.send(SitGoCommand::ForceUnregister { user_id }).await;
            return Err(e.into());
        }
    }
    Ok(())
}
```

```rust
// user_repo — conditional debit (works on SQLite):
// UPDATE users SET chip_balance = chip_balance - ? WHERE id = ? AND chip_balance >= ?
// rows_affected == 0  →  insufficient funds (no read-modify-write race)
```

For crash recovery, only refund registrations **persisted with a `paid` flag** (`tournament_registrations.chip_committed = true`), and do it in the same transaction that flips the tournament to `Cancelled` (see also B-11).

---

### [B-4] Payment webhooks are never mounted — users pay, chips never arrive; expiry task never runs

**Severity:** 🔴 Critical · **Subsystem:** payments / server wiring
**Files:** `backend/crates/sb-server/src/main.rs:592-623` (router assembly — no webhook route), `backend/crates/sb-payment/src/webhooks.rs:15` (`stripe_webhook` exported, zero call sites), `backend/crates/sb-payment/src/expiry.rs:6` (`start_expiry_task` never spawned)

**What's wrong:** `RealPaymentService` is constructed (main.rs:314-317) and `POST /shop/purchase` creates a Stripe Checkout Session and a `pending` payment row — but nothing ever confirms it:

```rust
// main.rs:593-605 — every merge, no webhook:
let app = Router::new()
    .merge(metrics_route)
    .merge(rest_router)
    .merge(ws_router)
    .merge(auth_router(auth_service.clone()))
    .merge(sb_bot_handler::attach(bot_state))
    ... // ← no stripe_webhook, no telegram_stars_webhook, no expiry task
```

`rg "stripe_webhook|telegram_stars_webhook|start_expiry_task" backend/` matches only definitions and exports. **Failure scenario:** a user completes a real Stripe checkout → the `payment_intents` row stays `pending` forever → chips are never credited while money has been taken. (The frontend makes this worse — see F-3: the shop UI doesn't even call this endpoint.)

**Fix:**

```rust
// main.rs — inside run_app, after state construction:
let payment_state = Arc::new(PaymentWebhookState {
    service: real_payment_service.clone(),
    user_repo: user_repo.clone(),
});

let app = Router::new()
    .route("/webhooks/stripe", axum::routing::post(sb_payment::webhooks::stripe_webhook))
    .route("/webhooks/telegram", axum::routing::post(sb_payment::webhooks::telegram_stars_webhook))
    .with_state(payment_state)
    .merge(rest_router)
    ...;

// spawn entitlement expiry once:
tokio::spawn(sb_payment::expiry::start_expiry_task(db.clone(), payment_service.clone()));
```

⚠️ Do **not** ship the webhook until E-series issues **P-2 (price ×100)** and **P-3 (Stars verification)** and **P-4 (idempotency)** are fixed — enabling the current webhook code would overcharge and double-credit.

---

### [P-1] 100× price bug — product price in cents is treated as a chip amount, then multiplied by 100

**Severity:** 🔴 Critical · **Subsystem:** payments
**Files:** `backend/crates/sb-payment/src/service.rs:189-190` (product.price → `ChipAmount`), `:80` (`× CHIP_TO_CENT_MULTIPLIER`), `:22` (`const CHIP_TO_CENT_MULTIPLIER: i64 = 100`), `backend/crates/sb-db-repos/src/product_repo.rs:35` (DB price / 100 → display), seed `backend/migration/src/m20260709_000001_create_products_table.rs:60-101`

**What's wrong:** The products table stores `price = 499` meaning **€4.99** (`product_repo.rs:35` divides by 100 for display). The purchase path instead treats that value as a *chip quantity*:

```rust
// service.rs:189-190
let amount = ChipAmount::new(product.price)...          // 499 "chips"
// service.rs:80
let amount_cents = amount.as_i64() * CHIP_TO_CENT_MULTIPLIER;   // 49,900 cents = €499.00
```

**Failure scenario:** The "Starter Pack" displays €4.99, charges **€499.00**, and the (currently unmounted) webhook would award `49900 / 100 = 499` chips instead of the 20,000 chips advertised in the product's metadata (`{chips: 20000}`) — which is never read on the award path.

**Fix:** Keep two distinct concepts — money and chips — as separate types, and award from product metadata:

```rust
// sb-shared-types: newtype so the compiler blocks this class of bug
pub struct Cents(i64);     // money
// ChipAmount stays the chip unit

// service.rs
pub async fn create_purchase(&self, user_id: UserId, product_id: &str, provider: &str)
    -> Result<PurchaseResponse, AppError>
{
    let product = self.product_repo.find(product_id).await?;
    let cents = Cents(product.price);                          // DB price is cents
    let chips  = product.metadata.get("chips")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| AppError::Internal("product missing chips metadata".into()))?;

    match provider {
        "stripe" => {
            let session = self.stripe.create_checkout_session(
                user_id, cents,                    // ← charge cents directly
                &serde_json::json!({ "chips": chips, "product_id": product_id }),
            ).await?;
            ...
        }
    }
}
```

And in the webhook, award `metadata.chips` (verified against the DB product), never `amount / 100`.

---

### [P-2] Telegram Stars webhook is wrong on every axis (header, payload, flow) — and chips are granted *before* payment

**Severity:** 🔴 Critical · **Subsystem:** payments
**Files:** `backend/crates/sb-payment/src/webhooks.rs:150-263`

**What's wrong:**
1. It verifies an HMAC of the body against a header `X-Telegram-Bot-Api-Signature` — **Telegram does not send that header**. It sends the static `X-Telegram-Bot-Api-Secret-Token` (compare with the value you passed to `setWebhook`). With real traffic, `received` is always `""` → every genuine request is rejected with 400.
2. `pre_checkout_query` carries the merchant payload in `invoice_payload`, not `metadata` — the `user_id` parse always fails → 400.
3. Chips are awarded **on pre-checkout** (before the user pays) and the handler **never calls `answerPreCheckoutQuery`** — so even a forged request grants chips and then aborts the payment: pay-nothing-get-chips (if the signature check were satisfiable at all).

**Fix — implement the actual Telegram Stars flow:**

```rust
pub async fn telegram_stars_webhook(
    State(state): State<Arc<WebhookState>>,
    headers: HeaderMap,
    body: String,
) -> impl IntoResponse {
    // 1) static secret token — constant-time compare
    let expected = state.config.telegram_webhook_secret.as_str();
    let Some(received) = headers.get("X-Telegram-Bot-Api-Secret-Token").and_then(|v| v.to_str().ok())
    else { return StatusCode::UNAUTHORIZED.into_response() };
    if !constant_time_eq(received.as_bytes(), expected.as_bytes()) {
        return StatusCode::UNAUTHORIZED.into_response();
    }

    let update: serde_json::Value = serde_json::from_str(&body)?;
    if let Some(q) = update.get("pre_checkout_query") {
        // 2) validate invoice_payload BEFORE answering; id 8s window
        let (user_id, product_id, chips) = parse_invoice_payload(
            q["invoice_payload"].as_str().unwrap_or(""))?;
        let ok = state.service.validate_pending(user_id, product_id).await.is_ok();
        // 3) MUST answer pre-checkout or the payment is aborted
        state.telegram.answer_pre_checkout_query(
            q["id"].as_str().unwrap_or(""), ok, if ok { "" } else { "Purchase could not be validated" }
        ).await?;
        return StatusCode::OK.into_response();
    }

    if let Some(msg) = update.get("message").filter(|m| m.get("successful_payment").is_some()) {
        let sp = &msg["successful_payment"];
        let (user_id, product_id, chips) = parse_invoice_payload(
            sp["invoice_payload"].as_str().unwrap_or(""))?;
        let telegram_charge_id = sp["telegram_payment_charge_id"].as_str().unwrap_or_default();
        // 4) idempotent confirmation keyed on the charge id (see P-3)
        match state.service.confirm_stars_payment(user_id, chips, telegram_charge_id).await {
            Ok(true)  => { /* first time: chips awarded */ }
            Ok(false) => { /* duplicate: ignore */ }
            Err(e)    => { error!(%e, "stars confirm failed"); return StatusCode::INTERNAL_SERVER_ERROR.into_response(); }
        }
    }
    StatusCode::OK.into_response()
}
```

---

### [P-3] Stripe webhook double-credits chips on redelivery (idempotency result discarded)

**Severity:** 🔴 Critical · **Subsystem:** payments
**Files:** `backend/crates/sb-payment/src/webhooks.rs:84-100`, `backend/crates/sb-payment/src/service.rs:200-236`

**What's wrong:** `confirm_payment` collapses "confirmed now" and "already succeeded" into the same `Ok(())`:

```rust
// service.rs
if existing.status == "succeeded" {
    warn!(.., "Duplicate confirmation ignored");
    return Ok(());              // ← caller cannot distinguish
}
```

and the webhook then unconditionally awards chips:

```rust
// webhooks.rs:95-99
if let Err(e) = state.award_chips_on_success(user_id, ChipAmount::new(chips)...)
```

Stripe retries every webhook until it receives a 2xx. If the first delivery's response is lost (LB timeout, deploy restart between confirm and respond), the retry **re-awards the chips**.

**Fix — make "first time" explicit and gate the award on it, plus event-level idempotency:**

```rust
// service.rs
pub async fn confirm_payment(&self, ctx: RequestContext, payment_id: &str, chips: i64)
    -> Result<bool, AppError>   // true = awarded this call
{
    // atomic transition: only the row that flips pending → succeeded awards chips
    let res = payment::Entity::update_many()
        .col_expr(payment::Column::Status, Expr::value("succeeded"))
        .filter(payment::Column::Id.eq(payment_id))
        .filter(payment::Column::Status.eq("pending"))
        .exec(&self.db).await?;
    if res.rows_affected == 0 { return Ok(false); }        // someone else confirmed it
    self.record_ledger(ctx, ...).await?;                   // chips movement, same txn
    Ok(true)
}

// webhooks.rs
let first_time = state.service.confirm_payment(ctx, &payment_id, chips).await?;
if first_time {
    state.award_chips_on_success(user_id, ChipAmount::new(chips)).await?;
}
// ALSO: processed_events table keyed on stripe event.id (UNIQUE) — insert-ignore at entry
```

---

### [S-1] GDPR/privacy endpoints: identity fully spoofable + password check bypass → PII export and deletion of any account

**Severity:** 🔴 Critical · **Subsystem:** REST / auth
**Files:** `backend/crates/sb-rest-router/src/gdpr_routes.rs:12-25` (local `AuthUser` shadows the real one), `:45-60` (empty-hash bypass), `backend/crates/sb-rest-router/src/lib.rs:80` (router merged without auth middleware), `backend/crates/sb-db-repos/src/gdpr_repo.rs:140-141` (NULL hash → `""`)

**What's wrong:**

```rust
// gdpr_routes.rs:14-24 — "auth" is a client-supplied header!
pub struct AuthUser(pub Uuid);
impl<S: Send + Sync> FromRequestParts<S> for AuthUser {
    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user_id = parts.headers.get("X-User-Id")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| Uuid::parse_str(s).ok())
            .unwrap_or_else(Uuid::new_v4);        // random UUID if absent
        Ok(AuthUser(user_id))
    }
}
```

```rust
// gdpr_routes.rs:45-57 — password "check"
if !hash_str.is_empty() { /* Argon2 verify */ } else { true }   // ← empty hash = valid
```

`DELETE /users/me` and `GET /users/me/data` therefore run **with no token verification at all**: identity comes from a caller-controlled header (or a random UUID). Any unauthenticated caller can export any user's profile (email, platform, balances) via `/users/me/data`, and can trigger deletion of **any passwordless (Telegram) account** — Telegram users have no password hash, so the `else { true }` branch approves the request.

**Fix:**

```rust
// Delete the local AuthUser entirely; use the crate that actually verifies JWTs:
use sb_auth::middleware::AuthUser;                       // validates Authorization/cookie

pub fn gdpr_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        .route("/users/me", delete(delete_user_handler))
        .route("/users/me/data", get(export_user_data_handler))
        .layer(sb_auth::middleware::auth_middleware_with_context(state.auth.clone()))
}

// Password confirmation:
let is_valid = match hash_res {
    Ok(hash_str) if !hash_str.is_empty() => PasswordHash::new(&hash_str).map(|parsed|
        Argon2::default().verify_password(payload.password.as_bytes(), &parsed).is_ok()
    ).unwrap_or(false),
    Ok(_) => false,   // ← passwordless accounts MUST use an alternative confirmation
                      //    (e.g. re-auth via Telegram initData challenge), never `true`
    Err(_) => false,
};
```

---

### [S-2] The rate limiter is a no-op — the 429 response is built and discarded, and every client shares one "unknown" bucket

**Severity:** 🔴 Critical · **Subsystem:** REST middleware
**Files:** `backend/crates/sb-rest-router/src/rate_limit/middleware.rs:92-136`, `backend/crates/sb-server/src/main.rs:~627-662` (`axum::serve` without `ConnectInfo`)

**What's wrong:** The over-limit branch constructs a 429 response into `_response`… and then falls through to `self.inner.call(req)`:

```rust
if !self.limiter.check_and_record(&ip) {
    let _response = axum::http::Response::builder()
        .status(axum::http::StatusCode::TOO_MANY_REQUESTS)
        .body(axum::body::Body::from("Too many requests"))
        .unwrap();
    // 40 lines of comments trying to figure out how to return a future…
    // "This will effectively disable rate limiting, but we'll fix it later."
}
self.inner.call(req)      // ← ALWAYS executed
```

Compounding it, the IP key comes from `ConnectInfo`, which is never provided:

```rust
// middleware.rs:86-90
let ip = req.extensions().get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
    .map(|addr| addr.ip().to_string())
    .unwrap_or_else(|| "unknown".to_string());     // ← every request, one bucket
```

`axum::serve(listener, app)` is called without `.into_make_service_with_connect_info::<SocketAddr>()` (main.rs), so the extension never exists. Net effect: **no rate limiting on login, password reset, fingerprint submission — anything** (the README advertises it as a security feature), and if the missing-IP branch ever did return 429s, it would lock out *everyone* simultaneously.

**Fix:**

```rust
// middleware.rs
fn call(&mut self, req: Request<B>) -> Self::Future {
    let ip = req.extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|| "unknown".into());

    if !self.limiter.check_and_record(&ip) {
        let response = axum::http::Response::builder()
            .status(axum::http::StatusCode::TOO_MANY_REQUESTS)
            .header(axum::http::header::RETRY_AFTER, "1")
            .body(axum::body::Body::empty())
            .unwrap();
        return Box::pin(std::future::ready(Ok(response)));   // ← actually return it
    }
    Box::pin(self.inner.call(req))
}
```

```rust
// main.rs
axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>()).await?;
```

Behind a proxy, derive the key from the **last trusted hop** (see S-9 for `X-Forwarded-For` handling), not from a raw client header.

---

### [T-1] Tournament directors consume `HandCompleted` events from **every** table — a cash-game bust eliminates a tournament player

**Severity:** 🔴 Critical · **Subsystem:** tournament directors
**Files:** `backend/crates/sb-tournament/src/mtt_director.rs:442-467`, `backend/crates/sb-tournament/src/sit_go_tournament.rs:400-433`; wiring: `sb-tournament/src/tournament_service.rs:264,290` (`registry.event_sender().subscribe()` — one global broadcast); event struct: `sb-table-registry/src/events.rs:10-19` (carries `table_id`/`room_id`, never checked)

**What's wrong:**

```rust
// mtt_director.rs:442-451
pub(crate) async fn handle_hand_completed(&mut self, event: HandCompletedEvent) {
    if !matches!(self.state, DirectorState::Running) { return; }
    for (user_id, _) in &event.busted_players {       // ← no event.table_id filter!
        if self.survivors.contains(user_id) {
            let position = self.survivors.len() as u32;
            self.survivors.remove(user_id);
```

The registry broadcasts every table's hand-completion to **all** subscribers (the actor even warns about it at `sb-table-registry/src/actor.rs:2542-2544`). The multi-tabling feature the frontend advertises makes this a guaranteed scenario, not a corner case.

**Failure scenario:** A player multi-tabling busts a **cash** table while registered in your MTT → the director eliminates them from the tournament (and pays nothing further for their live stack). Two concurrent tournaments sharing a player cross-eliminate each other. An SNG can hit `players_remaining <= 1` from cash busts and pay out while the "winner" is still all-in on another table. Additionally, `Ok(event) = rx.recv()` silently skips `RecvError::Lagged`, dropping eliminations under load.

**Fix:**

```rust
pub(crate) async fn handle_hand_completed(&mut self, event: HandCompletedEvent) {
    if !matches!(self.state, DirectorState::Running) { return; }

    // Only react to hands from tables this director owns
    let ours = match &event.room_id {
        Some(room) => self.tables.iter().any(|t| t.table_id == *room)
                          || self.table_id == Some(*room),
        None => false,
    };
    if !ours { return; }

    match rx.recv().await {
        Ok(event) => self.handle_hand_completed(event).await,
        Err(broadcast::error::RecvError::Lagged(n)) => {
            warn!(missed = n, "director lagged — reconciling");
            self.reconcile_from_tables().await;   // re-fetch stacks/survivors from table actors
        }
        Err(broadcast::error::RecvError::Closed) => break,
    }
}
```

(Same filter in `sit_go_tournament.rs`.)

---

### [T-2] `calculate_payouts` panics on an empty payout structure and overpays when percentages exceed 100%

**Severity:** 🔴 Critical (reachable crash of a director task) · **Subsystem:** tournament payouts
**Files:** `backend/crates/sb-tournament/src/payout_calculator.rs:9-21`; default empty structure from `backend/crates/sb-rest-router/src/tournament_routes.rs:86-91`

**What's wrong:**

```rust
let remainder = prize_pool - total_distributed;
if remainder > 0 {
    payouts[0].1 += remainder;    // ← index panic when structure.entries is empty
}
```

`POST /tournaments` defaults `payout_structure` to `PayoutStructure { entries: vec![] }`. At tournament end with a non-zero prize pool: `payouts` is empty, `remainder = prize_pool > 0` → `payouts[0]` **panics inside the director actor**, killing the task: no results recorded, no prizes paid, tables never shut down, players stranded. Separately, a structure summing to > 100% is accepted → `total_distributed > prize_pool` → more chips paid out than existed.

**Fix — validate at creation, fail soft at distribution:**

```rust
// tournament_routes.rs create_tournament
let pct: f64 = req.payout_structure.entries.iter().map(|e| e.percentage).sum();
if !(pct <= 100.0 + 1e-9) {
    return (StatusCode::BAD_REQUEST, Json(json!({"error": "payout percentages must sum to ≤ 100"}))).into_response();
}
if req.payout_structure.entries.is_empty() {
    req.payout_structure = PayoutStructure::default_for(req.max_players); // e.g. top 15% payouts
}
if req.max_players < 2 || req.min_players_to_start < 2 || req.min_players_to_start > req.max_players {
    return (StatusCode::BAD_REQUEST, Json(json!({"error": "invalid player bounds"}))).into_response();
}
```

```rust
// payout_calculator.rs
pub fn calculate_payouts(prize_pool: i64, structure: &PayoutStructure) -> Vec<(u32, i64)> {
    if structure.entries.is_empty() || prize_pool <= 0 { return vec![]; }
    // integer math — avoid f64 precision loss on big pools:
    let mut payouts = Vec::with_capacity(structure.entries.len());
    let mut distributed = 0i64;
    for e in &structure.entries {
        let amount = prize_pool
            .saturating_mul((e.percentage * 1000.0).round() as i64)
            / 100_000;
        payouts.push((e.position, amount));
        distributed += amount;
    }
    if let Some(first) = payouts.first_mut() {           // ← no index panic
        *first.1 += (prize_pool - distributed).max(0);
    }
    payouts
}
```

---

### [T-3] Empty blind schedule asserts the director to death mid-startup

**Severity:** 🔴 Critical · **Subsystem:** tournament
**Files:** `backend/crates/sb-tournament/src/blind_scheduler.rs:21-24`; triggered from `mtt_director.rs:409` / `sit_go_tournament.rs:375`

**What's wrong:**

```rust
pub fn new(levels: Vec<BlindLevel>) -> Self {
    assert!(!levels.is_empty(), "BlindScheduler requires at least one level");
```

`POST /tournaments` with an empty `blind_schedule` stores `BlindSchedule { levels: vec![] }`. On start, the actor has *already* set status `Running`, created the table, and seated the players — then `BlindScheduler::new` **asserts and the tokio task dies**. Players are seated at a table where no hand is ever dealt; the tournament is unrecoverable.

**Fix:** validate at the API boundary (see T-2's create handler: reject empty schedule with 400) and replace the assert with a typed error so a bad config can never kill a task:

```rust
pub fn new(levels: Vec<BlindLevel>) -> Result<Self, TournamentError> {
    if levels.is_empty() {
        return Err(TournamentError::InvalidConfig("blind_schedule must have ≥ 1 level"));
    }
    Ok(Self { levels, current_level_index: 0, level_start: Instant::now(),
              pending_advance: Arc::new(AtomicBool::new(false)) })
}
```

---

### [T-4] MTT finishing positions computed from `config.max_players`, not entrants — the bulk of the prize pool is never paid

**Severity:** 🔴 Critical · **Subsystem:** tournament payouts
**Files:** `backend/crates/sb-tournament/src/mtt_director.rs:714-724` (same pattern in `sit_go_tournament.rs:481-487`)

**What's wrong:**

```rust
let total_players = self.config.max_players;      // e.g. 500 — the CAP, not the entrant count
let mut position_map: HashMap<u32, UserId> = HashMap::new();
for (i, (user_id, _)) in self.elimination_order.iter().enumerate() {
    let position = total_players - i as u32;      // first bust gets position 500
```

An MTT that starts at `min_players_to_start` (say 20 of max 500) records its first bust as position **500**. The payout loop then looks up positions 1..30 — almost none of which exist in the map — and silently pays nobody but the final-table positions that happen to collide.

**Fix:**

```rust
let total_players = self.players.len() as u32;    // actual entrants (players registered at start)
```

Mirror the same fix in the SNG path, and add a payout invariant test: `sum(prizes) == prize_pool` for any entrant count.

---

### [F-1] Pre-actions (auto fold/check/call) **never execute** — the queued action is disarmed by re-renders

**Severity:** 🔴 Critical (core gameplay UX) · **Subsystem:** PWA
**Files:** `frontend/apps/pwa/src/hooks/usePreAction.ts:71-86`, `frontend/apps/pwa/src/pages/TablePage.tsx:655-660`, `:694` (100 ms re-render cadence)

**What's wrong:**

```tsx
// TablePage.tsx:655 — inline arrow → new identity on every render (~10×/sec while a timer runs)
const { preAction, togglePreAction, executingAction } = usePreAction({
  isMyTurn, toCall,
  sendAction: (action: string, amount?: number) =>
    activeRoomId ? sendAction(activeRoomId, action, amount) : undefined,
});
```

```ts
// usePreAction.ts:71-86 — cleanup clears the 400ms timer, re-run short-circuits:
const timer = setTimeout(() => { sendAction(action, amount); ... }, 400);
return () => clearTimeout(timer);
...
}, [isMyTurn, toCall, sendAction]);   // deps change every render
```

Sequence: effect fires → `executedRef.current = true` → 400 ms timer armed → TablePage re-renders (turn timer ticks at 100 ms) → new `sendAction` identity → cleanup **clears the timer** → effect re-runs → `executedRef.current === true` → early return. The queued auto-action is **never sent**; `executingAction` stays set forever ("Auto FOLD" flash frozen) and the pre-action chip remains "Queued".

**Fix — hold `sendAction` in a ref; never depend on its identity:**

```ts
export function usePreAction({ isMyTurn, toCall, sendAction }: UsePreActionParams) {
  const [preAction, setPreActionState] = useState<PreAction | null>(null);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const preActionRef = useRef<PreAction | null>(null);
  const executedRef = useRef(false);
  const sendRef = useRef(sendAction);
  useEffect(() => { sendRef.current = sendAction; });      // ← latest, identity-free

  useEffect(() => {
    if (!isMyTurn) { executedRef.current = false; return; }
    const pa = preActionRef.current;
    if (!pa || executedRef.current) return;
    executedRef.current = true;
    const call = toCall;
    const result = resolvePreAction(pa, call);             // switch extracted, unchanged
    if (!result) return;

    setExecutingAction(result.label);
    const { action, amount } = result;
    const timer = setTimeout(() => {
      sendRef.current(action, amount);                     // ← stable access
      setPreActionState(null); preActionRef.current = null; setExecutingAction(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [isMyTurn, toCall]);                                  // ← sendAction removed
  ...
}
```

---

### [F-2] Hero hole cards are never cleared between hands (store guard makes the "clear" call a no-op)

**Severity:** 🔴 Critical (privacy/UX of a poker client) · **Subsystem:** PWA shared store
**Files:** `frontend/packages/shared/src/stores/gameStore.ts:218-230`, `frontend/apps/pwa/src/hooks/useGameWebSocket.ts:676`, display injection at `frontend/apps/pwa/src/pages/TablePage.tsx:484-505`

**What's wrong:**

```ts
// WS hook on HandResult — intent: muck hero cards
store.setHeroHoleCards(roomId, []);
// gameStore:
setHeroHoleCards: (roomId, cards) => set((state) => {
  if (!state.rooms[roomId]) return {};
  if (cards && cards.length === 2) { /* set */ }   // ← [] fails the guard
  return {};                                       // ← so clearing does nothing
}),
```

Between hands, `TablePage.tsx:484-505` keeps injecting the **previous hand's hole cards** into the hero seat — stale private cards stay face-up on the table UI until the next `your_hole_cards` arrives (and mislead the player about what they hold during deal animations).

**Fix:**

```ts
setHeroHoleCards: (roomId, cards) =>
  set((state) => {
    if (!state.rooms[roomId]) return {};
    const next: [Card, Card] | null =
      cards && cards.length === 2 ? (cards as [Card, Card]) : null;
    return { rooms: { ...state.rooms, [roomId]: { ...state.rooms[roomId], heroHoleCards: next } } };
  }),
```

---

### [M-1] The Telegram Mini App is incompatible with the current backend protocol and store — the table view crashes or renders nothing

**Severity:** 🔴 Critical · **Subsystem:** mini-app
**Files:** `frontend/apps/mini-app/src/hooks/useGameWebSocket.ts:74-80, 104-107, 26-35, 91, 125`, `frontend/apps/mini-app/src/pages/TablePage.tsx:20-42`, `frontend/apps/mini-app/src/components/game/SeatGrid.tsx:48`, vs. `frontend/packages/shared/src/stores/gameStore.ts:153-169`

**What's wrong:** The mini-app still calls a **deleted store API** and parses an **abandoned wire format**:

```ts
// mini-app hook — functions that no longer exist on gameStore:
const { setSnapshot, setActionRequired, applyActionBroadcast, ... } = useGameStore();
if (message.type === 'TableState') setSnapshot(message);   // setSnapshot === undefined → TypeError
// players parsed as tuples `player[0]`/`player[1]` — backend sends objects {seat, user_id, stack…}
// player_action sent WITHOUT room_id; 'all-in' sent raw (server only accepts 'allin')
// SeatGrid reads seat.seat_index while the store's Seat uses seat.seat → Object.values(undefined) throws
```

**Failure scenario:** opening `/table/$tableId` in Telegram throws on the first WS message; actions can never reach the store; the app cannot actually play.

**Fix (recommended):** delete `frontend/apps/mini-app/src/hooks/useGameWebSocket.ts` and the mini-app's local game components, and re-use the PWA hook + shared store (hoist `useGameWebSocket` into `frontend/packages/shared/src/hooks/` and parameterize the WS base URL). If a gradual port is preferred, the minimum patch is:

```ts
// mini-app hook — align with the current protocol
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
const { setRoomState, setActionRequired, applyActionBroadcast, setHandResult, clearActionRequired } = useGameStore();
...
case 'TableState':
  setRoomState(roomId, message);                       // room-scoped, correct shape
  break;
case 'ActionRequired':
  setActionRequired(roomId, message);
  break;
...
// actions:
sendWsMessage('player_action', { room_id: roomId, action, amount });   // 'allin' not 'all-in'
```

---

### [B-5] Rebuy debits the wallet **before** the actor validates — rejection after enqueue silently destroys chips

**Severity:** 🔴 Critical · **Subsystem:** WS handler / actor
**Files:** `backend/crates/sb-ws-handler/src/lib.rs:477-531`, `backend/crates/sb-table-registry/src/registry.rs:337-353`, `backend/crates/sb-table-registry/src/actor.rs:1091-1127`

**What's wrong:**

```rust
// ws-handler: debit FIRST
match state.user_repo.update_chip_balance(ctx.clone(), *user_id, -amount).await { ... }
// then enqueue — Ok(()) only means "queued":
state.registry.send_rebuy(room_id, *user_id, stack).await
```

```rust
// actor.process_rebuy can still REJECT after the debit:
if player.stack > zero() { self.send_error_to(&user_id, "You still have chips, cannot rebuy"); return; }
```

`send_rebuy` returns `Ok` once the command is in the actor's queue; every actor-side rejection after that point keeps the debit with **no refund path**. Chips vanish.

**Fix — round-trip validation before money moves:**

```rust
// registry.rs
pub async fn validate_rebuy(&self, room_id: TableId, user_id: UserId, stack: ChipAmount)
    -> Result<(), AppError> {
    let (tx, rx) = oneshot::channel();
    self.send_internal(room_id, InternalCommand::ValidateRebuy { user_id, stack, respond_to: tx }).await?;
    tokio::time::timeout(Duration::from_secs(5), rx)
        .await.map_err(|_| AppError::Internal("rebuy validate timeout"))?
        .map_err(|_| AppError::Internal("validator dropped"))?
}

// ws-handler
state.registry.validate_rebuy(room_id, *user_id, stack).await?;      // actor pre-checks
state.user_repo.update_chip_balance(ctx.clone(), *user_id, -amount).await?;   // debit
state.registry.send_rebuy(room_id, *user_id, stack).await?;          // enqueue (accept guaranteed)
```

(Alternative: make the actor authoritative for money by giving it a repo handle and doing debit+seat in one actor step; either way, the invariant "a rejected buy never debits" must hold.)

---

### [B-6] Deferred leave refund is lost whenever the hand outlives the 15-second oneshot timeout

**Severity:** 🔴 Critical · **Subsystem:** table registry / actor
**Files:** `backend/crates/sb-table-registry/src/registry.rs:313-316` (timeout drops the receiver), `backend/crates/sb-table-registry/src/actor.rs:1983-1988` (deferred send into a dead channel), `backend/crates/sb-ws-handler/src/lib.rs:191-214`

**What's wrong:** A player leaving mid-hand is deferred until the hand ends (actor.rs:1162-1175). The registry's cleanup side waits at most 15 s:

```rust
let result = tokio::time::timeout(Duration::from_secs(15), rx).await ...;   // receiver dropped!
```

At hand end the actor does:

```rust
if let Some(responder) = player.leave_responder.take() {
    let _ = responder.send(LeaveResult::Refunded(player.stack));   // send fails silently
}
```

A typical hand lasts longer than 15 s → the receiver is gone → the send fails (`let _ =`) → the player is removed and their stack is **never credited back to the wallet**. Every disconnect during a hand destroys chips.

**Fix — refunds must be durable, not bounded by a oneshot:**

```rust
// actor.rs — on deferred leave completion, write the refund directly (actor owns a repo handle)
async fn settle_deferred_leave(&mut self, user_id: UserId, stack: ChipAmount) {
    let ctx = RequestContext::new(Uuid::new_v4(), Some(user_id));
    if let Err(e) = self.db.update_chip_balance(ctx, user_id, stack.as_i64()).await {
        error!(%e, %user_id, "leave refund failed — queueing retry");
        self.pending_refunds.push((user_id, stack));   // retried on next hand boundary / flush
    }
    // notify the (possibly new) connection if present
    self.send_to_user(&user_id, &json!({"type": "BalanceUpdated"}));
}
```

Keep the oneshot *only* as an opportunistic fast-path notification; the DB write must not depend on it.

---

### [S-3] Telegram `initData` never expires — a captured payload is a permanent login credential

**Severity:** 🔴 Critical · **Subsystem:** auth
**Files:** `backend/crates/sb-auth/src/auth_service.rs:91-138`, `backend/crates/sb-auth/src/config.rs:32-34` (empty-token default, see S-4)

**What's wrong:** The HMAC-SHA256 verification and canonicalization are correct (verified: sorted params, `hash` dropped, `\n`-join). But `auth_date` is **never parsed or checked**, and there is no nonce/jti:

```rust
let computed = hex::encode(mac.finalize().into_bytes());
if computed != hash { return Err(AppError::Unauthorized("Invalid initData".into())); }
// ← no auth_date freshness, no replay cache → POST /auth/telegram mints a 30-day JWT forever
```

**Failure scenario:** any initData string observed once (proxy log, screenshot, the client's own console) permanently authenticates that Telegram account.

**Fix:**

```rust
// after signature verification:
let auth_date: i64 = params.iter().find(|(k, _)| k == "auth_date")
    .and_then(|(_, v)| v.parse().ok())
    .ok_or_else(|| AppError::Unauthorized("missing auth_date"))?;
let now = chrono::Utc::now().timestamp();
if now - auth_date > 3600 {                                  // Telegram recommends ~1h
    return Err(AppError::Unauthorized("initData expired"));
}
// optional hardening: replay cache of `hash` values (SETNX with TTL in SQLite/redis)
```

Also make the comparison constant-time (`subtle::ConstantTimeEq` — the Stars webhook already has a `constant_time_eq` helper; reuse it), and fail fast when the bot token is unset (S-4).

---

### [S-4] Empty `TELEGRAM_BOT_TOKEN` default makes initData forgeable by anyone

**Severity:** 🔴 Critical · **Subsystem:** auth config
**Files:** `backend/crates/sb-auth/src/config.rs:32-34`

```rust
bot_token: SecretString::from(
    std::env::var("TELEGRAM_BOT_TOKEN").unwrap_or_else(|_| "".into()),
),
```

`HMAC_SHA256(key = "", msg = "WebAppData")` is computable by anyone, so with the env var unset an attacker can self-sign a valid `user` field for any Telegram id and log in as them. (`JWT_SECRET` correctly `expect`s; the bot token silently defaults.)

**Fix:**

```rust
bot_token: SecretString::from(
    std::env::var("TELEGRAM_BOT_TOKEN").expect("TELEGRAM_BOT_TOKEN must be set"),
),
// …and/or in auth_service: if bot token is empty, disable /auth/telegram entirely.
```

---

### [B-7] The tournament registration endpoint takes the user id from the request body — anyone can register anyone

**Severity:** 🔴 Critical · **Subsystem:** REST authz
**Files:** `backend/crates/sb-rest-router/src/tournament_routes.rs:174-198` (register), `:201-218` (unregister), `:61-109` (create); router merged with no auth layer at `backend/crates/sb-server/src/main.rs:601`

```rust
async fn register(State(state): ..., Path(tournament_id): Path<TournamentId>,
                  Json(req): Json<RegisterRequest>) -> ... {   // pub user_id: UserId — attacker-chosen
    let ctx = RequestContext::new(Uuid::new_v4(), Some(req.user_id));
    state.tournament_service.register(&ctx, tournament_id, req.user_id).await
```

No `Extension<AuthUser>` anywhere in this router (only `get_my_table` uses the real identity). Combined with B-3 (no buy-in debit) today this is griefing; after B-3 is fixed it becomes **forced chip drainage** (attacker registers victims into tournaments, debiting their wallets).

**Fix:** derive identity from the verified JWT; gate creation:

```rust
async fn register(
    State(state): State<Arc<TournamentState>>,
    AuthUser(user_id): AuthUser,                      // from sb_auth middleware
    Path(tournament_id): Path<TournamentId>,
) -> impl IntoResponse {
    state.tournament_service.register(&ctx_from(user_id), tournament_id, user_id).await
}
```

…and wrap the tournament router with `auth_middleware_with_context` before merging (same treatment for `season_card.rs` [B-13] and `notification_routes` unsubscribe [B-19]).

---

## 4. 🟠 High Findings

---

### [S-5] Password reset does not invalidate existing JWTs — stolen sessions survive account recovery

**Severity:** 🟠 High · **Subsystem:** auth
**Files:** `backend/crates/sb-auth/src/jwt.rs:47-54` (`verify_jwt` checks only `exp`), `backend/crates/sb-auth/src/auth_service.rs:334-341` (`verify_token` ignores `password_changed_at`), `backend/crates/sb-auth/src/password_reset_service.rs:95-98`

**What's wrong:** The `Claims` struct mints `password_changed_at` and the DB column is updated on reset — but `verify_token` never loads or compares it. The `sessions` table (migration `m20260607_000001:84-115`) is never consulted anywhere. After a password reset (e.g., after an account-takeover report), the attacker's stolen token remains valid for up to `JWT_EXPIRY_DAYS` (default **30**).

**Fix:**

```rust
// auth_service.rs
async fn verify_token(&self, token: &str) -> Result<TokenClaims, AppError> {
    let claims = verify_jwt(token, self.config.jwt_secret_str())?;
    let user_id = UserId(claims.sub);

    let changed_at: Option<i64> = self.user_repo.get_password_changed_at(user_id).await?; // cache 60s
    if let Some(ts) = changed_at {
        let iat = claims.iat.unwrap_or(0) as i64;
        if iat <= ts {
            return Err(AppError::Unauthorized("token revoked — please sign in again".into()));
        }
    }
    Ok(TokenClaims { user_id, platform: claims.platform })
}
```

(If a DB hit per request is unacceptable, keep a per-user `token_version` in Redis/SQLite with a 60 s cache; the check is one indexed lookup.)

---

### [S-6] Bot webhook accepts forged updates (no secret-token check) — anyone can impersonate any user to the bot

**Severity:** 🟠 High · **Subsystem:** Telegram bot
**Files:** `backend/crates/sb-bot-handler/src/handler.rs:11-14`, `:29-51`

```rust
pub async fn telegram_webhook(State(state): State<Arc<BotState>>, Json(payload): Json<Value>) -> ... {
    // dispatches /poker, /challenge on behalf of payload.message.from.id — no verification
```

Anyone who can reach `/telegram/webhook` posts a crafted update with any `from.id` and drives bot commands as that user (creating tables, issuing challenges).

**Fix:** set a `secret_token` when calling `setWebhook` and verify the header (constant-time), exactly as in P-2's fix.

---

### [P-4] Stars "invoice link" leaks the raw bot token; the flow is fictional

**Severity:** 🟠 High · **Subsystem:** payments
**Files:** `backend/crates/sb-payment/src/service.rs:145-166`

```rust
let invoice_link = format!("https://t.me/{}/stars?amount={}",
    self.config.telegram_bot_token,      // ← full "123456:ABC-DEF…" token in a client URL
    amount.as_i64());
```

Not a valid Telegram payment URL, and it hands the complete bot credential to every client. The synthetic pending id (`tg_{uuid}_{ts}`) can never reconcile with what the webhook sends.

**Fix:** call the Bot API `createInvoiceLink` (or `sendInvoice` in-chat), store the returned link/id on the pending payment row, and never serialize the token. Reject the whole Stars path with 503 until implemented.

---

### [P-5] No refund/chargeback/expiry handling for Stripe — free-chip loop with zero risk

**Severity:** 🟠 High · **Subsystem:** payments
**Files:** `backend/crates/sb-payment/src/webhooks.rs:53-136`

Only `checkout.session.completed` is handled; `charge.refunded`, `charge.dispute.created`, `checkout.session.expired` all fall through to `200 OK` silently. A user buys chips, requests a Stripe refund, keeps the chips.

**Fix:** handle `charge.refunded` / `charge.dispute.created` by clawing back the ledger (negative chip adjustment floor-clamped at 0, flag the account), `checkout.session.expired` by closing the pending row; log a warning for every unrecognized event type instead of silent 200.

---

### [T-5] `TableInfo.players` is never pruned — final-table merge resurrects busts, exhausts seats, strands live players

**Severity:** 🟠 High · **Subsystem:** MTT director
**Files:** `backend/crates/sb-tournament/src/mtt_director.rs:447-467` (busts not removed), `:547-596` / `:635-683` (transfers not reflected), `:598, 685-688` (retain/truncate on stale rosters); supporting actor behavior `sb-table-registry/src/actor.rs:739-749, 837-851` (missing player → stack 0 / nil id)

**What's wrong:** `TableInfo.players` accumulates every entrant forever. `fetch_player_stacks` reports busted players with stack 0; `compute_final_table_moves` then "moves" dead entries, `TransferPlayerIn` re-inserts them with 0 chips, consuming the 9 seats; real players get `TournamentFull`, which the director **silently drops** (`if let Ok(seat_result)`); `truncate(1)` then drops the other tables' handles while the table actors keep running — live players are stranded on orphaned tables the director no longer drives. The same staleness breaks `compute_rebalance_moves` (dead entries inflate table sizes so short tables never get broken).

**Fix (director bookkeeping):**
1. On elimination (`handle_hand_completed`): remove the user from `TableInfo.players` of their table.
2. On `TransferPlayerOut/In` success: update both rosters.
3. Make transfer failures loud: on `Err`, retry once, then **cancel the tournament with refunds** rather than continuing with half-moved tables.
4. Before computing moves, rebuild rosters from live `TableState` (stacks + seated users) instead of the append-only list.

```rust
async fn prune_table_rosters(&mut self) {
    for table in &mut self.tables {
        if let Ok(state) = self.fetch_table_state(table.table_id).await {
            table.players.retain(|uid| state.seated_users.contains(uid));
        }
    }
}
```

---

### [T-6] Final-table dealer seat randomized over the *tournament* max (0..500) on a 9-max table

**Severity:** 🟠 High · **Subsystem:** MTT director
**Files:** `backend/crates/sb-tournament/src/mtt_director.rs:690-693`; validation `sb-table-registry/src/actor.rs:772-783`

```rust
let dealer_seat = { let mut rng = rand::rng();
    rng.random_range(0..self.config.max_players as u8) };   // max_players can be 500
```

`ResumeHand { force_dealer_seat: Some(372) }` fails `seat < 9` → `Err(InvalidSeat)` → discarded by the director (`let _ =`). The random-dealer feature silently no-ops whenever `max_players > 9`.

**Fix:** `rng.random_range(0..self.table_config.max_players as u8)` — better, pick from actually-occupied seats so the button always lands on a player:

```rust
let occupied: Vec<u8> = final_table_state.seats.iter()
    .filter(|s| s.user_id.is_some()).map(|s| s.seat_index).collect();
let dealer_seat = *occupied.choose(&mut rand::rng()).ok_or(TournamentError::NoPlayers)?;
```

---

### [T-7] Completed MTTs report `Running` forever and leak their director actors

**Severity:** 🟠 High · **Subsystem:** tournament service
**Files:** `backend/crates/sb-tournament/src/mtt_director.rs:789-829` (status mapping), `run()` (no exit on completion), `sb-tournament/src/tournament_service.rs:74-77` (`remove_actor` exists but is never called)

```rust
status: match self.state {
    DirectorState::Registering => "Registering".into(),
    _ => "Running".into(),          // Completed / Pausing also report Running
},
```

After `end_tournament`, the task keeps polling, its command sender stays in `mtt_actors` forever, and the lobby shows phantom running tournaments (SNG correctly reports `Completed`).

**Fix:** map `DirectorState::Completed => "Completed"`, `break` the run loop after `end_tournament()`, and call `remove_actor(tournament_id)` from the service once the completion event is observed (also drop the event-bus subscription).

---

### [T-8] Antes are announced to clients but never collected at the table

**Severity:** 🟠 High (poker-rule violation) · **Subsystem:** tournament ↔ table actor
**Files:** `backend/crates/sb-tournament/src/mtt_director.rs:484-492`, `sit_go_tournament.rs:440-447`; command `sb-table-registry/src/actor.rs:250-253` (`SetBlinds { small, big }` — no ante field); scheduler already tracks antes (`blind_scheduler.rs:34-62`)

The `BlindLevel.ante` is parsed, scheduled and broadcast in `TournamentBlindLevel { ante, .. }`, but the command sent to tables drops it:

```rust
let _ = table.cmd_tx.send(TableCommand::SetBlinds { small: sb, big: bb }).await;  // ante gone
```

Players see an ante HUD that never exists; all-in/equity math in tournaments with antes is wrong from level 2 on.

**Fix:** extend the command and the hand setup:

```rust
// actor.rs
SetBlinds { small: ChipAmount, big: ChipAmount, ante: ChipAmount },
// in start_new_hand: before dealing, each non-folded seated player posts `ante`
// into total_bet (not bet_this_round), pot += ante × n; BB ante variant: post once from BB.
```

---

### [T-9] Rebalance/final-table moves ignore table capacity (9-max)

**Severity:** 🟠 High · **Subsystem:** MTT rebalancer
**Files:** `backend/crates/sb-tournament/src/rebalancer.rs:45-68`; consumer drop at `mtt_director.rs:583-594`

The round-robin distribution picks the smallest-load target with **no cap at table max**; `TransferPlayerIn` then rejects with `TournamentFull`, which the director silently drops — while the source table is retained/closed. Players disappear from the tournament's managed tables.

**Fix:**

```rust
let capacity = self.config.table_size as usize;           // 9
targets.sort_by_key(|t| t.players.len());
for move_ in moves {
    let target = targets.iter_mut()
        .find(|t| t.players.len() < capacity)             // ← hard cap
        .ok_or(TournamentError::NoCapacity)?;
    target.players.push(move_.user_id);
}
// and in the director: propagate transfer errors — retry, then settle refunds (see T-5)
```

---

### [B-8] Crash-recovery refund can mint chips again on every restart (non-atomic refund → status flip)

**Severity:** 🟠 High · **Subsystem:** tournament crash recovery
**Files:** `backend/crates/sb-tournament/src/crash_recovery.rs:41-65`

```rust
if let Err(e) = user_repo.update_chip_balance(ctx.clone(), reg.user_id, buy_in).await { ... }
if let Err(e) = repo.set_status(tournament.id, TournamentStatus::Cancelled, None).await {
    error!(...);   // logs and CONTINUES
}
```

`settle_crashed_tournaments` runs on **every startup** for tournaments still `Running`. If `set_status` fails, or the process dies between refund and status flip, the next restart refunds the same registrations again. The only guard is "player has a recorded result", which doesn't cover already-refunded players.

**Fix:** journal the refund in the same transaction as the status change:

```rust
let txn = db.begin().await?;
for reg in registrants_needing_refund {
    // mark refunded INSIDE the txn; UPDATE tournament_registrations
    //   SET refunded = true WHERE tournament_id = ? AND user_id = ? AND refunded = false
    let n = mark_refunded(&txn, tournament.id, reg.user_id).await?;
    if n == 1 {
        credit_chips(&txn, reg.user_id, buy_in).await?;   // same txn
    }
}
repo.set_status_in_txn(&txn, tournament.id, Cancelled).await?;
txn.commit().await?;
```

…and combine with B-3's `chip_committed` flag so a refund can never exceed what was actually paid.

---

### [B-9] `refresh_leaderboard_mv` runs `BEGIN`/`COMMIT` as separate pooled statements — broken every 5 minutes

**Severity:** 🟠 High · **Subsystem:** DB / leaderboards
**Files:** `backend/crates/sb-db-repos/src/leaderboard_repo.rs:61-93`; scheduled by `backend/crates/sb-server/src/leaderboard_refresh.rs:10` every 5 min

```rust
db.execute_unprepared("BEGIN").await?;
db.execute_unprepared("DELETE FROM leaderboard_global_mv").await?;   // possibly another connection!
db.execute_unprepared("INSERT INTO leaderboard_global_mv ... ").await?;
db.execute_unprepared("COMMIT").await?;                              // conn has no open txn
```

Each `execute_unprepared` on `&DatabaseConnection` can hit a *different* pooled connection. The `COMMIT` fails ("no transaction is active") every cycle; worse, readers can observe an **empty leaderboard** between the DELETE and the INSERT (autocommit on a third connection).

**Fix:**

```rust
let txn = db.begin().await?;
txn.execute_unprepared("DELETE FROM leaderboard_global_mv").await?;
txn.execute_unprepared("INSERT INTO leaderboard_global_mv SELECT ...").await?;
txn.commit().await?;
// or: one execute_unprepared with the whole batch, or CREATE TABLE mv_new; …; ALTER TABLE RENAME
```

---

### [B-10] Production runs the in-memory test-double notification service — all notifications silently dropped

**Severity:** 🟠 High · **Subsystem:** server wiring / notifications
**Files:** `backend/crates/sb-server/src/main.rs:359-365`, `backend/crates/sb-server/src/test_utils/notification_service.rs:69-79`

```rust
let (notification_service, bot_handler) = {
    let notif = Arc::new(InMemoryNotificationService::new());   // send() = log + Ok(())
```

`TelegramNotificationService` (`sb-notification/telegram.rs`) and `MultiChannelNotifier` (`multi_channel.rs`) are fully implemented but never wired in `run_app`. Tournament reminders, results, club reminders, push — everything no-ops in production while the log pretends success.

**Fix:**

```rust
let notifier: Arc<dyn NotificationService> = if cfg!(test) || config.dev_mode {
    Arc::new(InMemoryNotificationService::new())
} else {
    Arc::new(MultiChannelNotifier::new(
        Arc::new(TelegramNotificationService::new(config.telegram_bot_token.clone(), http.clone())),
        Arc::new(WebPushSender::new(vapid_config.clone())),
        Arc::new(EmailSender::new(resend_api_key.clone())),
    ))
};
```

---

### [B-11] The entire anti-cheat engine is dead code; the one mounted endpoint stores raw client fingerprints

**Severity:** 🟠 High · **Subsystem:** anti-cheat
**Files:** `backend/crates/sb-anti-cheat/src/service.rs:27, 195-250` (zero call sites repo-wide), `backend/crates/sb-server/src/anti_cheat_routes.rs:18-21` (only `/anti-cheat/fingerprint` mounted), `repository/mod.rs:103-130` (stored verbatim)

`record_heads_up`, `check_transfer`, `check_game_action_rate` are never invoked from any game or transfer path. The README advertises collusion/velocity detection; none runs. The fingerprint endpoint accepts any client-supplied string unvalidated — rotating a fake fingerprint per login defeats device-linking by design.

**Fix:** instantiate `AntiCheatServiceImpl` in `run_app`; call `check_transfer` from every chip-movement path (rebuy, transfer, kick refunds), `record_heads_up` from table pairing after each hand; validate fingerprints server-side (normalize + hash to 64-hex before storage; reject anything else).

---

### [B-12] `GET /hands/{id}` is unauthenticated and returns every player's hole cards

**Severity:** 🟠 High · **Subsystem:** hand archive / privacy
**Files:** `backend/crates/sb-server/src/hand_archive.rs:67-71, 143-161` (merged unauthenticated at main.rs:599), share URLs from `hand_history_repo.rs:414`

Anyone holding a hand UUID (they're shared via replay `share_url`) can read the full hand JSON **including all seats' hole cards** — even for hands they didn't play and replays marked private.

**Fix:**

```rust
async fn get_hand(AuthUser(user_id): AuthUser, Path(id): Path<Uuid>, State(st): State<Arc<ArchiveState>>) -> ... {
    let hand = st.repo.get(id).await?.ok_or(StatusCode::NOT_FOUND)?;
    let participants = hand.participants.split(',').map(str::to_string).collect::<Vec<_>>();
    if !participants.contains(&user_id.to_string()) && !hand.share_public {
        return StatusCode::FORBIDDEN.into_response();     // participants-only, or public-flagged
    }
    // redact hole cards of non-showdown streets for non-participants
}
```

---

### [B-13] GDPR export returns stub data and anonymization leaves PII across the schema

**Severity:** 🟠 High (compliance) · **Subsystem:** GDPR
**Files:** `backend/crates/sb-db-repos/src/gdpr_repo.rs:87-91` (export stubs), `:94-123` (`anonymize_user` clears only `users`), `:125-127` (`invalidate_sessions` no-op), `backend/crates/sb-server/src/main.rs:755-793` (`JobScheduler::new().await.unwrap()` in a spawned job — a panic kills GDPR processing silently)

```rust
hand_history: serde_json::json!([]),     // export is fake
missions: serde_json::json!([]),
```

`anonymize_user` clears the user row but leaves the pseudonymous user id inside `hand_history.participants` (CSV), `device_fingerprints`, referrals, tournament registrations/results and analytics events. The export endpoint hands users an empty JSON — an GDPR Art. 15 violation if deployed.

**Fix:** real export queries per table (participants LIKE, user_id = …), plus anonymization UPDATEs for each dependent table (`hand_history.participants` string-replace, `device_fingerprints` delete, `tournament_registrations/results` re-key to anon id). Propagate job errors to Sentry; never `.unwrap()` a scheduler in a spawned task.

---

### [B-14] CORS blocks the HTTP methods the API itself serves (DELETE, PUT)

**Severity:** 🟠 High · **Subsystem:** server wiring
**Files:** `backend/crates/sb-server/src/main.rs:570-575`

```rust
let cors = CorsLayer::new()
    .allow_origin(allowed_origins.clone())
    .allow_credentials(true)
    .allow_methods([Method::GET, Method::POST, Method::OPTIONS]);
```

`DELETE /users/me` (gdpr), any DELETE/PUT routes fail browser preflight. The PWA's GDPR deletion flow can never work from a browser even after S-1 is fixed.

**Fix:** `.allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::PATCH, Method::OPTIONS])`.

---

### [B-15] Writer loop: unbounded channel, +100 ms latency floor on every write, queued commands dropped on shutdown

**Severity:** 🟠 High · **Subsystem:** DB
**Files:** `backend/crates/sb-db-repos/src/writer_loop.rs:24, 42, 44-77`

```rust
let (tx, rx) = mpsc::unbounded_channel();          // no backpressure
let mut flush_interval = interval(Duration::from_millis(100));
...
_ = shutdown_rx.changed() => { process_batch(...); break; }   // in-channel backlog dropped
```

All chip movements serialize through this single task with a deliberate 100 ms batching window — a throughput ceiling and latency floor on the hottest path. Under a write storm, memory grows without bound; on shutdown only the current batch is flushed and everything still queued is lost (including pending chip credits).

**Fix:** bounded channel (`mpsc::channel(10_000)`) with a defined full-policy (await when full — callers are already async); drain on shutdown:

```rust
_ = shutdown_rx.changed() => {
    if *shutdown_rx.borrow() {
        while let Ok(cmd) = rx.try_recv() { batch.push(cmd); }   // drain
        let _ = process_batch(&db, &mut batch).await;            // flush
        break;
    }
}
```

Also: chip-balance writes should skip the batching window (`flush_now` flag) or read balances directly from the DB instead of round-tripping through the writer for every lobby render.

---

### [B-16] `DbCommand::CheckClubPro` panics the single DB writer if ever dispatched

**Severity:** 🟠 High (loaded gun) · **Subsystem:** DB writer loop
**Files:** `backend/crates/sb-db-repos/src/writer_loop.rs:136-140`

The context-extraction `match` hits `unimplemented!()` for `CheckClubPro` **before** the real handler branch at `:443` can ever be reached. Nothing sends it today — one future producer kills the writer task, after which **every write in the process fails** with send errors.

**Fix:** implement the arm (extract `ctx` properly) or delete the variant; add `unreachable!()`-free exhaustiveness via an enum-level test. **Never** `unimplemented!()` inside a singleton dispatcher.

---

### [F-3] The shop purchase flow calls an endpoint that doesn't exist — every purchase 404s

**Severity:** 🟠 High · **Subsystem:** PWA shop
**Files:** `frontend/apps/pwa/src/lib/shopApi.ts:44-46`; used by `usePurchaseFlow.confirmPurchase`; the real endpoint is `POST /shop/purchase` (`backend/crates/sb-rest-router/src/shop_routes.rs:34`); Vite proxy only forwards `/api` (`frontend/apps/pwa/vite.config.ts:55-66`)

```ts
export async function createPaymentIntent(req: CreateIntentRequest): Promise<CreateIntentResponse> {
  const validated = CreateIntentRequestSchema.parse(req);
  const res = await fetch('/payments/create-intent', {    // ← no such route, not even /api
```

**Fix:**

```ts
export async function createPurchase(req: CreateIntentRequest): Promise<PurchaseResponse> {
  const validated = CreateIntentRequestSchema.parse(req);
  return apiClient<PurchaseResponse>('/shop/purchase', { method: 'POST', body: JSON.stringify(validated) });
  // consume response.checkout_url (Stripe) or response.invoice_link (Stars)
}
```

---

### [F-4] Settings → Privacy is wired to four endpoints that don't exist

**Severity:** 🟠 High · **Subsystem:** PWA / GDPR
**Files:** `frontend/apps/pwa/src/routes/settings/privacy.tsx:34, 42, 58, 73`; backend only exposes `DELETE /users/me` + `GET /users/me/data` (`gdpr_routes.rs:34-35`)

```ts
queryFn: () => apiClient<DeletionStatus>('/gdpr/status'),          // 404
apiClient('/gdpr/request-deletion', ...)                           // 404
apiClient('/gdpr/cancel-deletion', ...)                            // 404
apiClient<{ download_url: string }>('/gdpr/export', ...)           // 404
```

The whole deletion/export UI always errors.

**Fix:** map to real endpoints — deletion: `apiClient('/users/me', { method:'DELETE', body: JSON.stringify({ password }) })`; export: `GET /users/me/data`. For the missing "status/cancel" features, either add the server routes (a `deletion_requests` table with status + cancel) or remove those UI sections until they exist.

---

### [F-5] Forgot-password / reset / verify-email / Telegram auth fetch the wrong URLs — the whole flow is dead

**Severity:** 🟠 High · **Subsystem:** shared auth client
**Files:** `frontend/packages/shared/src/auth/api.ts:40-95`

```ts
forgotPassword: async (email: string) => {
  const response = await fetch('/auth/forgot-password', { ... });   // ← missing /api prefix
```

Five methods (`forgotPassword`, `resetPassword`, `verifyEmail`, `resendVerification`, `telegramAuth`) bypass the `request()` helper that adds the `/api` prefix + headers, hitting the frontend origin directly (404 in dev via Vite proxy rules, 404/401 in most prod ingress layouts).

**Fix:** route all five through the same `request()` helper used by `login`/`register` — one code path, one prefix, one error shape.

---

### [F-6] Tournament "already registered" state can never load — Register button always shows for registered users

**Severity:** 🟠 High · **Subsystem:** PWA tournaments
**Files:** `frontend/apps/pwa/src/routes/tournaments/$tournamentId.tsx:72-79`; backend `tournament_routes.rs:51-57` has no `/registrations` route

```ts
queryFn: () => apiClient<{ user_id: string }[]>(`/tournaments/${tournamentId}/registrations`), // 404
const isRegistered = registrations?.some((r) => r.user_id === userId) || false;                // always false
```

**Fix (server):** add `GET /tournaments/{id}/registrations` returning `{registered: bool, count}` from `count_registrations` + a per-user check (the contract method `list_registrations` already exists unused at `sb-contracts/src/tournament_api.rs`); or include `is_registered` in `GET /tournaments/{id}` (the response schema already has the field).

---

### [F-7] Web Push subscription is broken three independent ways — push can never be enabled

**Severity:** 🟠 High · **Subsystem:** PWA notifications
**Files:** `frontend/apps/pwa/src/services/notifications/transport.ts:23-29` (wrong body shape), `frontend/apps/pwa/src/lib/push.ts:29,46,71` (endpoint without `/api`, no auth header), `frontend/apps/pwa/src/services/notificationService.ts:76-79` (`applicationServerKey` commented out), plus two contradictory implementations (`services/notificationService.ts` vs `services/notifications/*`); backend expects flat `{endpoint, keys}` + `AuthUser` (`notification_routes.rs:22-26, 62`)

Net effect: every path to enable push fails (422 / 401 / 404 / Chrome `BadRequestError`).

**Fix — one implementation:**

```ts
// services/pushService.ts (single source of truth)
export async function enablePush(reg: ServiceWorkerRegistration, token: string) {
  const vapid = await apiClient<{ public_key: string }>('/notifications/vapid-public-key');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid.public_key),   // ← required
  });
  const json = sub.toJSON();                                          // {endpoint, keys}
  await apiClient('/notifications/subscribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),  // ← flat shape
  });
}
```

Delete the other two implementations and their tests.

---

### [F-8] The raise slider hardcodes big blind = 10 for every table (blinds never reach the client)

**Severity:** 🟠 High · **Subsystem:** PWA / protocol gap
**Files:** `frontend/apps/pwa/src/components/game/ActionBar.tsx:928` (`bigBlind = 10`), `:577,859` (`step={bigBlind || 10}`), `frontend/apps/pwa/src/pages/TablePage.tsx:1125-1140` (no blinds prop); root cause: `TableStateUpdate` has **no blinds fields** (`backend/crates/sb-table-registry/src/game_room.rs:46-59` — verified struct)

At a 100/200 table the slider steps by 10 and the 2BB/3BB/½-pot presets are nonsense; at micro stakes the presets can exceed max and disable. The lobby knows the stakes (`routes/lobby.tsx:32-37`) but the value never reaches the table.

**Fix (protocol first):**

```rust
// game_room.rs TableStateUpdate
pub small_blind: u64,
pub big_blind: u64,
// actor.rs build_table_state: fill from self.mode / table config
```

```tsx
// TablePage.tsx
const bigBlind = room.tableState?.big_blind ?? 10;
<ActionBar bigBlind={bigBlind} ... />
// ActionBar: step = bigBlind; presets = [2,3,5,10].map(m => m * bigBlind)
```

---

### [F-9] Club settings update has no ownership check — any authenticated user can deface any club

**Severity:** 🟠 High · **Subsystem:** clubs
**Files:** `backend/crates/sb-club/src/handlers.rs:141-162` (`PATCH /clubs/{club_id}/settings`), route at `router.rs:16-19`; `update_club` also broadcasts `club_updated` **twice** (`:164-182`)

```rust
pub async fn update_club_settings(...) -> ... {
    let _user_id = extract_user_id(&ctx)?;    // authz ends here — never compared to owner
    match state.service.update_pro_settings(&ctx, club_id, req).await {
```

Any logged-in user can rename any club, hijack its `telegram_group_id` (redirecting club notifications to an attacker-controlled chat), and change Pro theme settings.

**Fix:**

```rust
let club = state.service.get_club(club_id).await?;
if club.created_by != user_id && !is_platform_admin(&user_id) {
    return Err(ClubError::Forbidden);
}
```

…and send the `club_updated` broadcast once.

---

### [F-10] `is_club_pro_active` is a hardcoded `Ok(true)` — the Club-Pro entitlement gate is bypassed

**Severity:** 🟠 High · **Subsystem:** clubs / payments
**Files:** `backend/crates/sb-club/src/service.rs:267-269`

```rust
async fn is_club_pro_active(&self, _user_id: UserId) -> Result<bool, ClubError> {
    Ok(true)
}
```

The only consumer (`upload_banner`, handlers.rs:208-211) grants the paid banner feature to everyone. The real check exists as `DbCommand::CheckClubPro` but dispatching it panics the writer (B-16).

**Fix:** implement a real lookup (entitlements table: `SELECT 1 FROM entitlements WHERE user_id=? AND kind='club_pro' AND expires_at > now()`), wire it, and delete the `CheckClubPro` dead variant.

---

### [H-1] Daily-reward claim has a double-claim window (check outside txn; chips awarded before commit)

**Severity:** 🟠 High · **Subsystem:** missions
**Files:** `backend/crates/sb-mission/src/service.rs:252-258` (check), `:262-279` (txn begins), `:331-337` (award → commit)

```rust
if assignments.iter().any(|a| !a.completed || a.reward_claimed) { return Err(...); }  // read
let txn = self.db.begin().await?; ...
active.reward_claimed = Set(true); ...
self.user_service.award_chips(user_id, chip_amount).await?;   // ← external, before commit
txn.commit().await?;
```

Two concurrent `POST /missions/claim` both read `reward_claimed = false` and both award. Conversely, a commit failure after `award_chips` leaves the missions claimable again.

**Fix — conditional UPDATE gate + award-after-commit:**

```rust
let res = daily_assignment::Entity::update_many()
    .col_expr(daily_assignment::Column::RewardClaimed, Expr::value(true))
    .filter(daily_assignment::Column::UserId.eq(user_id))
    .filter(daily_assignment::Column::AssignedDate.eq(today))
    .filter(daily_assignment::Column::Completed.eq(true))
    .filter(daily_assignment::Column::RewardClaimed.eq(false))
    .exec(&txn).await?;
if res.rows_affected < EXPECTED_DAILY_MISSIONS {
    txn.rollback().await.ok();
    return Err(AppError::Conflict("reward already claimed"));
}
txn.commit().await?;
self.user_service.award_chips(user_id, chip_amount).await?;   // after commit; on failure, log to outbox
```

---

### [H-2] The weekly streak bonus is permanently forfeited after any streak break

**Severity:** 🟠 High · **Subsystem:** missions
**Files:** `backend/crates/sb-mission/src/service.rs:302-316`

```rust
if today_streak % 7 == 0 && today_streak > streak_model.weekly_bonus_awarded_streak {
    total_chips += 10000; ...
}
// but on streak break (reset path :302-304) weekly_bonus_awarded_streak stays at e.g. 14
```

After reaching 14 and missing a day, the streak resets to 1, and `7 > 14` is false forever — **the 10,000-chip weekly bonus + shield can never be earned again** by that user.

**Fix:** reset `weekly_bonus_awarded_streak` to 0 in the same code path that resets `today_streak` (and ideally track "current cycle max" instead of a lifetime max).

---

### [H-3] 5 of 33 mission types can progress — daily rewards are mostly uncompletable

**Severity:** 🟠 High · **Subsystem:** missions
**Files:** `backend/crates/sb-mission/src/service.rs:101-115`; `HandResult` has no win/outcome fields (`sb-shared-types/src/game_types.rs:48-53`); `on_share_created` has zero production callers

```rust
let new_progress = match assignment.mission_type.as_str() {
    "play_10_hands" | "play_20_hands" => assignment.progress + 1,
    "raise_preflop_10" if hand_result.hero_raised_preflop => assignment.progress + 1,
    "showdown_5" if ... => ..., "all_in_3" if ... => ...,
    _ => assignment.progress,    // win_flush, quads, bluff, viral… never progress
};
```

`claim_daily_reward` requires **all 3** daily missions completed; with 28/33 types dead, most users draw an uncompletable set and rerolls (1 per mission) land on other dead types.

**Fix:** extend `HandResult` with outcome data (`won: bool, best_rank: Option<HandRank>, hero_won_showdown: bool` — the engine already computes `calculate_pot_winners` and mission flags), emit typed `MissionProgressEvent`s from the actor, and **restrict the daily pool to implementable types** as a stopgap:

```rust
const IMPLEMENTABLE: &[&str] = &["play_10_hands","play_20_hands","raise_preflop_10","showdown_5","all_in_3"];
```

---

### [B-17] Disconnect cleanup can force-leave a just-reconnected player (fire-and-forget race)

**Severity:** 🟠 High · **Subsystem:** WS handler / actor
**Files:** `backend/crates/sb-ws-handler/src/lib.rs:191-214`; reconnect path `actor.rs:865-905`

On socket close, the handler spawns per-room `Leave { force: true }` tasks with wallet refunds. A mobile network blip that reconnects quickly can complete `reconnect` **before** the old socket's spawned `Leave` executes → the live player is removed mid-hand and their stack credited to the wallet.

**Fix — generation counter per user:**

```rust
// actor.rs
self.conn_epoch.entry(user_id).and_modify(|e| *e += 1).or_insert(1);
Leave { user_id, force: true, epoch, respond_to }
// in leave handling: if epoch < self.conn_epoch[&user_id] { return Ok(LeaveResult::Stale); }
// ws-handler reconnect: bump epoch first (handled by actor), then re-subscribe.
```

---

### [F-11] Kick-vote countdown freezes; initiation is unreachable; `sitting_out` is never parsed

**Severity:** 🟠 High (feature cluster broken) · **Subsystem:** PWA
**Files:** `frontend/apps/pwa/src/components/game/KickVoteDialog.tsx:44-74` (interval torn down by changing deps; `clearInterval` inside a state updater), `TablePage.tsx:1167` (new `onTimeout` identity each render), `:403-409` (sets `yesVotes`/`passed` keys that don't exist in the dialog state type), `:771-792` (`_handleKick` unused), `SeatGrid.tsx:102-112` (no `onKick` prop), `useGameWebSocket.ts:162-179` (no `sitting_out` in parse)

Players can *vote* on kick votes but can never *start* one; sit-out state never displays; `SitOutButton.tsx` is imported nowhere. The dialog's countdown stalls because the 10 Hz parent re-renders recreate the interval.

**Fix:** (a) pass `onKick={_handleKick}` through `SeatGrid → PlayerSpot`; (b) parse `sitting_out` into the `Seat` type and render `SitOutButton`; (c) in `KickVoteDialog`, compute expiry from a `deadlineRef` inside a `setInterval` created once (`[]` deps), and drop `onTimeout`/`votes` from deps by using refs.

---

### [M-2] The Telegram Mini App has no Telegram login — `initData` is never used

**Severity:** 🟠 High · **Subsystem:** mini-app auth
**Files:** `frontend/apps/mini-app/src/routes/login.tsx:28-41` (username/password only), `frontend/packages/shared/src/auth/api.ts:82-95` (`telegramAuth` exists, zero callers), `frontend/apps/mini-app/index.html:8` (loads `telegram-web-app.js`)

The app's whole reason for existing (frictionless Telegram identity) is unimplemented: users must remember poker-site passwords inside Telegram.

**Fix (after S-3/S-4 server fixes):**

```tsx
// mini-app main.tsx / __root.tsx
useEffect(() => {
  const tg = (window as any).Telegram?.WebApp;
  if (!tg?.initData) return;
  tg.ready(); tg.expand();
  authApi.telegramAuth(tg.initData)
    .then(({ token }) => { authStore.getState().setToken(token); router.navigate({ to: '/' }); })
    .catch(() => router.navigate({ to: '/register' }));
}, []);
```

---

### [B-18] `join_table` silently defaults the buy-in to 1000 and seats **before** funds are confirmed

**Severity:** 🟠 High · **Subsystem:** WS handler
**Files:** `backend/crates/sb-ws-handler/src/lib.rs:341-345, 400-445`; mini-app triggers it (`mini-app/src/hooks/useGameWebSocket.ts:91` sends no `buy_in`)

```rust
let buy_in: i64 = parsed.get("buy_in").and_then(|b| b.as_i64()).unwrap_or(1000);
```

A client that omits `buy_in` buys in 1000 regardless of table stakes (then may fail min/max). The seat is granted first and the debit runs after; the insufficient-funds path runs a compensating `send_leave` — two non-atomic steps where a crash in between leaves seat/broadcast state inconsistent.

**Fix:** require an explicit `buy_in` (reject the message without one), verify funds **before** `join_room_full`, and make the actor's join the single source of seat truth (send the debit *after* the actor confirms the seat via its respond channel, with the compensation path only for the narrow race window).

## 5. 🟡 Medium Findings

---

### [E-4] "Pot odds" analytics are wrong by construction — `(pot/to_call)/10`

**Severity:** 🟡 Medium · **Subsystem:** game engine analytics + bots
**Files:** `backend/crates/sb-game-engine/src/game_state.rs:687-691` (player-facing `AnalyticsPayload`), `backend/crates/sb-poker-bots/src/actor.rs:161-165` (bot decision), `engine.rs:34`

```rust
let pot_odds = if to_call.as_i64() > 0 {
    (self.pot.as_i64() as f32 / to_call.as_i64() as f32) / 10.0   // ÷10 fudge, not pot odds
} else { 0.0 };
```

Pot odds are the ratio of the call to the pot-after-your-call. The current formula makes "pot odds" 1.0 for a pot-sized bet, so bots (`decide()` compares `equity > pot_odds`) call virtually anything, and the player-facing HUD displays a meaningless number.

**Fix:**

```rust
let pot_odds = if to_call > 0 { to_call as f32 / (pot + to_call) as f32 } else { 0.0 };
// bots: call if equity > pot_odds  (now actually correct)
// bots: clamp tilted equity:  effective_equity = (equity * if tilted {1.2} else {1.0}).min(1.0)
```

---

### [E-5] Monte Carlo simulation (500 iters) runs synchronously inside the table actor for every `ActionRequired`

**Severity:** 🟡 Medium (perf) · **Subsystem:** game engine / actor
**Files:** `backend/crates/sb-game-engine/src/game_state.rs:708-716` (`run_monte_carlo(hole, community, 500)` inside `action_required_for_current_player`)

Every action request blocks the room's event loop on ~500 × 5–7-card evaluations. With the bot fleet plus multi-tabling this adds measurable latency to every broadcast, and it runs even when the client never renders analytics.

**Fix:** compute lazily on demand (a `get_analytics` WS request), or `tokio::task::spawn_blocking` with a 50 ms budget, or precompute at street start rather than per action. Also cap iterations by street (200 preflop is plenty; 1000 river).

---

### [E-6] Showdown with an incomplete board splits the pot equally **without evaluating hands**

**Severity:** 🟡 Medium · **Subsystem:** game engine
**Files:** `backend/crates/sb-game-engine/src/game_state.rs:809-820`

The deck-exhaustion fallback paths (`end_round`, lines 478-533) can complete a hand with fewer than 5 community cards; `calculate_pot_winners` then splits every pot equally among eligible players — a royal flush chops with high-card. Unreachable in practice today (52-card decks can't exhaust), but it's the kind of latent fallback that becomes a real bug the moment a feature touches the deck (e.g., short-deck variants, issue #051).

**Fix:** evaluate on the available cards (best 5-of-N), or make deck exhaustion `unreachable!()` with an explicit invariant test `community_cards.len() == 5` before showdown; either way never pay without comparing hands.

---

### [E-7] `force_fold` skips the round-completion check for non-current players

**Severity:** 🟡 Medium (latent) · **Subsystem:** game engine
**Files:** `backend/crates/sb-game-engine/src/game_state.rs:126-157`

`force_fold` (used for sit-outs/leaves/timeouts) advances the turn only if the folder is the current player, and never re-checks `round_complete()`. Today the only player who can be "pending action" is the current player, so the stall needs a future caller (e.g., "fold any player on leave") to hang a hand. Cheap to harden:

```rust
if idx == self.current_player_index {
    self.advance_turn();
} else if self.round_complete() {
    self.end_round();
}
```

---

### [T-10] Tournament list endpoints always report `registered: 0`

**Severity:** 🟡 Medium · **Subsystem:** tournament service
**Files:** `backend/crates/sb-tournament/src/tournament_service.rs:455-467`, club variant `sb-club/src/handlers.rs:390-402`

`registered: 0` is hardcoded while `TournamentRepo::count_registrations` (`tournament_api.rs:239`) sits unused. Lobbies and club pages show zero entrants; SNGs never look joinable.

**Fix:** `registered: self.repo.count_registrations(t.id).await?.unwrap_or(0)` per summary (or one `GROUP BY tournament_id` query for the list).

---

### [T-11] `unregister_player_txn` shrinks the prize pool even when nothing was deleted

**Severity:** 🟡 Medium · **Subsystem:** tournament repo
**Files:** `backend/crates/sb-db-repos/src/tournament_repo.rs:98-116` (and the same read-modify-write pool pattern at `:67-78`, `:302-340`)

```rust
tournament_registration::Entity::delete_many()...exec(&txn).await?;   // rows_ignored
active.prize_pool = Set((active.prize_pool.unwrap() - buy_in.as_i64()).max(0));
```

Unregistering a user who isn't registered still decrements the pool by one buy-in — pool deflation that eventually comes out of winners' prizes. The RMW pattern also relies on SQLite busy-errors instead of atomic `col_expr` arithmetic.

**Fix:** check `rows_affected` before touching the pool; use `Expr::col(Tournament::PrizePool).add(buy_in)` / `.sub(...)` so the DB performs the arithmetic atomically.

---

### [T-12] Registration mutates actor state, then `?`-propagates repo failure — memory/DB divergence

**Severity:** 🟡 Medium · **Subsystem:** MTT director
**Files:** `backend/crates/sb-tournament/src/mtt_director.rs:250-263` (register), `:295-303` (unregister)

```rust
self.players.push(RegisteredPlayer { ... });
self.prize_pool = ChipAmount::new(self.prize_pool.as_i64() + buy_in.as_i64()).unwrap();
if let Some(repo) = &self.tournament_repo {
    repo.register_player(self.tournament_id, user_id, buy_in).await?;   // fails AFTER local commit
}
```

A DB hiccup returns an HTTP error while the actor considers the player registered with an inflated pool; retries get `Conflict("Already registered")`. Unregister has the mirror problem.

**Fix:** persist first, mutate the actor on success (B-3's flow already restructures this — keep the ordering: debit → persist → actor command, compensating backwards on each failure).

---

### [B-19] Mission `MissionId` is a positional index over an unordered DB read — reroll can hit the wrong mission

**Severity:** 🟡 Medium · **Subsystem:** missions
**Files:** `backend/crates/sb-mission/src/service.rs:161-176` (`id: MissionId(i as u32)` over `find().all()` with **no `order_by`**), `:188-227` (reroll indexes by that id; reroll candidates don't exclude the current mission's own type)

Between `GET /missions/today` and `POST /missions/reroll`, row order can change (any DB), mapping the same `MissionId` to a different assignment — users reroll/complete the wrong mission. A reroll can also reassign the identical mission type, resetting progress while consuming the one reroll.

**Fix:** add a stable `ORDER BY mission_type` (or expose the DB row id in the DTO), and filter candidates `!= current.mission_type`:

```rust
let assignments = daily_assignment::Entity::find()
    .filter(...)
    .order_by_asc(daily_assignment::Column::MissionType)   // stable mapping
    .all(&self.db).await?;
let candidates: Vec<&str> = IMPLEMENTABLE.iter()
    .copied().filter(|t| !used_types.contains(t) && *t != current_type).collect();
```

---

### [B-20] Referral bonus: increment gate is atomic but award/mark are not — a transient failure forfeits the bonus forever

**Severity:** 🟡 Medium · **Subsystem:** viral
**Files:** `backend/crates/sb-viral/src/lib.rs:104-128`, `backend/crates/sb-db-repos/src/referral_repo.rs:47-95`

`increment_hand_count_and_check_bonus` (WHERE hand_count < 5) correctly prevents double-awards, but if `award_chips` or `mark_bonus_awarded` fails after the increment, `hand_count` is already 5 and every later call gets `rows_affected == 0` — the bonus is lost permanently on both sides.

**Fix:** single conditional claim:

```sql
UPDATE referrals
SET bonus_awarded = true, bonus_awarded_at = now()
WHERE referred_user = ? AND hand_count >= 5 AND NOT bonus_awarded
-- rows_affected == 1 → award chips (outbox on failure); == 0 → already claimed/not due
```

---

### [B-21] Hand-history list endpoints load entire result sets and scan `INSTR(participants, ?)`

**Severity:** 🟡 Medium (perf) · **Subsystem:** DB
**Files:** `backend/crates/sb-db-repos/src/hand_history_repo.rs:97-107, 219-247`

```rust
let models = query.all(&self.db).await?;          // no .limit(...) — full scan, full materialize
let has_next = models.len() > limit as usize;     // paginated in memory
```

`participants` is a TEXT CSV with **no index** (migration only indexes `played_at`/`table_id`), so `/hands` and `/tables/{id}/history` full-scan `hand_history` and materialize all matching rows, every call.

**Fix:** push the limit down (`query.limit(limit as u64 + 1)`); longer term, normalize participants into a `hand_participants(hand_id, user_id)` join table with an index on `user_id` (SQLite supports the schema; the writer loop is the single place to maintain it).

---

### [B-22] Hand-history retention cutoff is frozen at process start — cleanup silently stops

**Severity:** 🟡 Medium · **Subsystem:** DB housekeeping
**Files:** `backend/crates/sb-db-repos/src/hand_history_repo.rs:439-452`

```rust
let cutoff = chrono::Utc::now() - chrono::Duration::days(retention_days);  // computed ONCE
loop { interval.tick().await; ...delete where played_at < cutoff... }
```

After the first pass, no new rows ever fall below the frozen cutoff — retention stops working until restart (and silently disagrees with the 30-day R2 archival assumption in `hand_archive.rs:97`).

**Fix:** move the cutoff computation inside the loop.

---

### [B-23] `join_club` computes the division from a non-serialized count

**Severity:** 🟡 Medium · **Subsystem:** clubs
**Files:** `backend/crates/sb-db-repos/src/club_repo.rs:74-90`

Two concurrent joins read the same `count` and both insert into the same division (the unique index covers only `(club_id, user_id)`), producing divisions of `DIVISION_SIZE + 1` members and skewing weekly rebalancing.

**Fix:** `BEGIN IMMEDIATE` (SQLite write lock) around count+insert, or maintain `clubs.member_count` with an atomic `UPDATE ... SET member_count = member_count + 1 RETURNING member_count` and derive the division from that.

---

### [B-24] Season-end processor holds a DB transaction across image generation + R2 uploads; failed seasons retry forever

**Severity:** 🟡 Medium · **Subsystem:** season cards
**Files:** `backend/crates/sb-server/src/season_card_generator.rs:59-135`; PK/FK constraints `m20260607_000001:175-191`

The transaction stays open for N × (PNG render + network upload). The reset-row insert fails if `season_id + 1` already has rows (PK) or doesn't exist as a season (FK) — and since `processed` is only set at the end, the same season is retried **every hour forever**.

**Fix:** (1) commit the rank-reset in a short transaction first, (2) upsert reset rows (`on_conflict_do_update`), (3) create the next season row if missing, (4) generate/upload cards **outside** any transaction, (5) persist `season_card_generation` rows idempotently so a retry skips completed cards.

---

### [B-25] `/api/analytics/event` always 500s — merged after the `Extension(AppState)` layer

**Severity:** 🟡 Medium · **Subsystem:** analytics
**Files:** `backend/crates/sb-server/src/main.rs:612-613`, `sb-rest-router/src/analytics_routes.rs:17-19`

```rust
.layer(axum::Extension(app_state.clone()))                       // wraps routes added BEFORE
.merge(sb_rest_router::analytics_routes::analytics_routes())     // ← NOT wrapped → 500
```

Axum layers only apply to routes registered before them; the analytics handler's `Extension<Arc<AppState>>` extractor can never be satisfied. The client's fire-and-forget telemetry silently dies.

**Fix:** `.merge(analytics_routes())` **before** the `.layer(...)`, or have the handler take `State<Arc<AppState>>`.

---

### [B-26] `/metrics` is public; per-route counters leak operational data

**Severity:** 🟡 Medium · **Subsystem:** observability
**Files:** `backend/crates/sb-server/src/main.rs:582, 593, 799-805`

The Prometheus endpoint is merged into the public router (README even says "expose `/metrics` only to your monitoring network" — the code doesn't).

**Fix:** split it onto a second listener bound to `127.0.0.1` / the internal network, or require a bearer token middleware.

---

### [B-27] `POST /notifications/unsubscribe` requires no auth

**Severity:** 🟡 Medium · **Subsystem:** notifications
**Files:** `backend/crates/sb-rest-router/src/notification_routes.rs:44-49, 90-106`

`subscribe` requires `AuthUser`; `unsubscribe` deletes by endpoint with no identity check — anyone who learns a subscription endpoint URL (they leak in logs) can silence a user's push.

**Fix:** require `AuthUser` and delete `WHERE user_id = ? AND endpoint = ?`.

---

### [B-28] Telegram notifications: unescaped user content interpolated into `parse_mode: Markdown` bodies

**Severity:** 🟡 Medium · **Subsystem:** notifications
**Files:** `backend/crates/sb-notification/src/telegram.rs:46-50`, `multi_channel.rs:20-39`

Club names, tournament names and reminder messages flow into Markdown-parsed bodies. `[click](https://evil)` in a club name injects links into the club chat; unbalanced `*_` corrupts rendering.

**Fix:** escape Markdown specials in all user-derived strings (`fn md_escape(s: &str) -> String { s.replace(|c| "*_[]()~`>#+-=|{}.!".contains(c), "") }`) or switch to `parse_mode: "HTML"` with `html_escape`.

---

### [B-29] Client-supplied `X-Forwarded-For` is the identity for rate limiting, collusion IPs and audit logs

**Severity:** 🟡 Medium (after S-2 is fixed it becomes High again) · **Subsystem:** server
**Files:** `backend/crates/sb-server/src/main.rs:128-135`

```rust
let ip = req.headers().get("x-forwarded-for")
    .and_then(|v| v.to_str().ok())
    .and_then(|s| s.split(',').next())      // ← attacker-controlled first hop
    ... .unwrap_or_else(|| "0.0.0.0".into());
```

Any client rotates its "IP" per request; one malicious proxy header poisons another user's collusion profile.

**Fix:** accept `X-Forwarded-For` only from a configured trusted-proxy hop count (take the *n*-th from the right), or use `ConnectInfo` (after S-2) when not behind a proxy.

---

### [B-30] Password-reset tokens are stateless and replayable within their TTL

**Severity:** 🟡 Medium · **Subsystem:** auth
**Files:** `backend/crates/sb-auth/src/password_reset_service.rs:73-102`

The `purpose` claim is checked (good), but there's no single-use registry and no `iat <= password_changed_at` comparison: a leaked reset token can be reused until TTL expiry to repeatedly set a known password.

**Fix:** store `jti` in a `used_tokens` table inside the same transaction as the password update (unique constraint makes replay fail), or check `claims.iat > user.password_changed_at` before accepting.

---

### [B-31] Room assignment races: `active_players` sampled pre-join; reaper can kill fresh/spectator rooms

**Severity:** 🟡 Medium · **Subsystem:** table registry
**Files:** `backend/crates/sb-table-registry/src/registry.rs:119-166` (`assign_room`), `:627-661` (`spawn_room_reaper`), consumer `ws-handler:388-397`

`assign_room` checks `room.active_players.load(Relaxed) < max` *before* the actor processes the `Join`; N simultaneous joiners are all assigned the same "non-full" room and then rejected by the actor with "Table is full" after `RoomAssigned` was already sent. The reaper removes any room with `active_players == 0` every 60 s — including a freshly assigned room whose Join hasn't landed, and spectator-only rooms.

**Fix:** make the actor the arbiter — `assign_room` sends a `ReserveSeat` command with a respond channel and only returns rooms that accepted; the reaper requires `active_players == 0 && user_senders.is_empty() && age > 10 min`.

---

### [B-32] `user_senders` leak: reconnect registers a channel before knowing the user is seated; not-found leaves never clean it

**Severity:** 🟡 Medium · **Subsystem:** table actor
**Files:** `backend/crates/sb-table-registry/src/actor.rs:870` (insert on reconnect), `:1137-1141` (not-found leave path keeps the entry)

Every `reconnect` from a non-seated user permanently registers their (eventually dropped) channel in the room's broadcast map; every subsequent broadcast marks them dead and spawns a doomed `Leave` task — per-message task churn plus unbounded map growth.

**Fix:** insert into `user_senders` only on the seated path (or remove it in the not-found leave branch):

```rust
InternalCommand::Leave { .. } if !self.players.contains_key(&user_id) => {
    self.user_senders.remove(&user_id);          // ← add
    let _ = respond_to.send(LeaveResult::Refunded(zero()));
    return;
}
```

---

### [B-33] `/season-cards` queries a hardcoded `Uuid::nil()` — feature dead, and unauthenticated

**Severity:** 🟡 Medium · **Subsystem:** season cards
**Files:** `backend/crates/sb-rest-router/src/season_card.rs:23-42` (merged with no auth at main.rs:602)

```rust
let user_id = Uuid::nil();       // every caller gets the nil-user's (empty) cards
```

**Fix:** take `AuthUser`, pass it through. (Also see B-24 for the generator.)

---

### [F-12] Infinite-scroll fetch fires during render (HistoryDialog)

**Severity:** 🟡 Medium · **Subsystem:** PWA
**Files:** `frontend/apps/pwa/src/components/game/HistoryDialog.tsx:103-107`

```ts
const lastItem = items[items.length - 1];
if (lastItem && lastItem.index >= allHistory.length - 1 && hasNextPage && !isFetchingNextPage) {
  fetchNextPage();     // ← side effect during render
}
```

Triggers "Cannot update a component while rendering a different component", duplicate fetches under StrictMode, and render loops.

**Fix:**

```ts
const lastIndex = items[items.length - 1]?.index ?? -1;
useEffect(() => {
  if (lastIndex >= allHistory.length - 1 && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }
}, [lastIndex, allHistory.length, hasNextPage, isFetchingNextPage, fetchNextPage]);
```

---

### [F-13] Pot "blip" ripple is dead code due to action casing

**Severity:** 🟡 Medium · **Subsystem:** PWA
**Files:** `frontend/apps/pwa/src/components/game/PotBadge.tsx:93-97`, root cause `useGameWebSocket.ts:214` (`data.action.toUpperCase()`)

```ts
if (lastAction && ['bet', 'raise', 'call', 'all-in'].includes(lastAction.action)) {
```

`parseMessage` uppercases broadcast actions, so the array of lowercase names never matches — the pot ripple never fires.

**Fix:** `['bet','raise','call','all-in'].includes(lastAction.action.toLowerCase())` (and normalize `'allin'` too, since the backend sends that spelling in places).

---

### [F-14] WS reconnect never gives up (even on auth failure) and there is no heartbeat

**Severity:** 🟡 Medium · **Subsystem:** PWA
**Files:** `frontend/apps/pwa/src/hooks/useGameWebSocket.ts:686-695`

Every `onclose` (expired token, server restart, network death) schedules another reconnect at up to 30 s — forever, with no cap and no `ping` keepalive; dead TCP connections behind proxies can linger for minutes while the UI claims "Connected".

**Fix:**

```ts
ws.onclose = (ev) => {
  cleanup();
  if (ev.code === 4001 || ev.code === 1006 && reconnectAttempts.current >= 8) {
    setConnectionStatus('disconnected');        // stop + show manual "Reconnect" button
    return;
  }
  const delay = Math.min(3000 * 1.5 ** reconnectAttempts.current++, 30000);
  reconnectTimeoutRef.current = setTimeout(connect, delay);
};
// heartbeat:
useEffect(() => {
  const iv = setInterval(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send('{"type":"ping"}');
    if (Date.now() - lastPongRef.current > 45000) wsRef.current?.close();
  }, 15000);
  return () => clearInterval(iv);
}, []);
```

(Server: reply to `ping` and add a `tokio::time::timeout` on idle reads to reap half-open sockets.)

---

### [F-15] `register_tournament` is dead code — sent before the socket opens

**Severity:** 🟡 Medium · **Subsystem:** PWA
**Files:** `frontend/apps/pwa/src/hooks/useGameWebSocket.ts:778-787` (effect runs once on mount; `connect()` is deferred 100 ms at `:704`)

```ts
if (tournamentId && wsRef.current?.readyState === WebSocket.OPEN) {   // always CONNECTING
  sendWsMessage('register_tournament', ...);
```

Live tournament events (blind level, table changed) never arrive on the table page; the unregister cleanup never runs either. Related: TablePage's "waiting for tournament" poll (`TablePage.tsx:428-450`) reads the store **once** — if the tournament isn't Running at mount, the 5 s poll never arms and the user is stranded.

**Fix:** queue the intent like `buyInRef` does — store `pendingRegisterRef.current = tournamentId` and send it in `onopen`; make the waiting screen subscribe to the store status (`useTournamentStore(s => s.tournaments[id]?.status)`) so the poll arms when the state changes.

---

### [F-16] `?buyIn=` navigation wipes ALL multi-table rooms; buy-in dialog limits disagree with the lobby/server

**Severity:** 🟡 Medium · **Subsystem:** PWA
**Files:** `frontend/apps/pwa/src/pages/TablePage.tsx:301-305` (`useGameStore.setState({ rooms: {}, activeRoomId: null })`), `:946-948` (hardcoded `minBuyIn=100, maxBuyIn=200000, defaultBuyIn=1000`)

The app advertises multi-tabling, but opening any lobby "Buy In" link nukes every other seat client-side mid-session (backend keeps them). The dialog's hardcoded limits disagree with the lobby's per-stake 20BB/200BB rules — the server rejects values the dialog accepts.

**Fix:** reset only the target room (`removeRoom(tableId)` then `addRoom`), and derive `min/max` from the table config delivered in `TableStateUpdate` (add `min_buy_in`/`max_buy_in` next to F-8's blinds).

---

### [F-17] Two conflicting club-WebSocket clients; fallback URL hardcodes `ws://localhost:3000`

**Severity:** 🟡 Medium · **Subsystem:** PWA / shared
**Files:** `frontend/apps/pwa/src/hooks/useClubWebSocket.ts:28-29`, `frontend/packages/shared/src/lib/websocket.ts:33-107`

```ts
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';   // hook — fails in any real deploy
// singleton: connects with NO token, subscribes 'club:*', reconnects even after disconnect()
```

Both dispatch the same `club:event` DOM event → duplicate invalidations/toasts; the singleton's `onclose` reschedules after `disconnect()`.

**Fix:** delete one implementation (keep the hook), fall back to `window.location.protocol === 'https:' ? 'wss://' : 'ws://' + window.location.host`, pass the JWT, and null out handlers in `disconnect()`.

---

### [F-18] Purchase flow hardcodes Stripe and subscribes to the whole store — Telegram Stars path unreachable

**Severity:** 🟡 Medium · **Subsystem:** PWA payments
**Files:** `frontend/apps/pwa/src/hooks/usePurchaseFlow.ts:7, 23-24`

```ts
const shop = useShopStore();            // whole-store subscription → re-render storms
provider: 'stripe', // TODO: allow user to choose
```

`usePaymentProvider()` / `useIsMiniApp()` exist; the backend supports `telegram_stars` — but the flow always requests Stripe, pushing Mini-App users to external card checkout.

**Fix:** `const provider = useIsMiniApp() ? 'telegram_stars' : 'stripe';` and select store slices (`useShopStore(s => s.items)`).

---

### [F-19] Feedback hook compares a user ID to a seat number — "skip my own turn" guard never works

**Severity:** 🟡 Medium · **Subsystem:** PWA
**Files:** `frontend/apps/pwa/src/pages/TablePage.tsx:161-173`

```ts
String(game.currentTurnUserId) !== String(resolvedHeroSeat)   // UUID vs seat index 0-8
```

The guard can never be true, so turn-based audio cues (e.g., `chipClink`) fire for your own turn too.

**Fix:** `const turnSeat = game.getSeatByUserId(game.currentTurnUserId); ... turnSeat !== resolvedHeroSeat`.

---

### [F-20] 10 Hz full-tree re-renders while any turn timer runs; unmemoized derived seat maps

**Severity:** 🟡 Medium (perf) · **Subsystem:** PWA
**Files:** `frontend/apps/pwa/src/pages/TablePage.tsx:694` (`setInterval(updateRemaining, 100)` + setState), `:733`, `:483-526` (seat maps rebuilt each render)

While a turn timer runs, the entire page re-renders 10×/s; `seatsWithHeroCards`/`seatsWithShowdown` get fresh identities so `DealAnimationLayer`, `BetAnimationLayer`, `CommunityCards`, `PotBadge`, `ActionBar`, `RaiseSlider` all re-concile each tick — visible jank on mobile. This cadence is also the root amplifier of F-1, F-11 and F-19.

**Fix:** keep the countdown in a ref and update only the `TimerBar` via its own `requestAnimationFrame`; throttle to 250 ms; wrap derived seat maps in `useMemo` keyed on `seats`; memoize the callbacks passed to `usePreAction`/`KickVoteDialog` with `useCallback`.

---

### [M-3] The mini-app contains a dead parallel app (React-Router tree, stores, API client) with a stale schema

**Severity:** 🟡 Medium · **Subsystem:** mini-app
**Files:** `frontend/apps/mini-app/src/App.tsx` (entire; `<Route path="/table/:id" element={<div>Table View (to be implemented)</div>} />`), `pages/LobbyPage.tsx`, `stores/tableStore.ts`, `lib/api.ts` (no `Authorization` header), `lib/api.schema.ts:9` (`status: 'waiting'|'playing'` vs backend `"active"`)

`main.tsx` uses TanStack Router; `App.tsx` + friends form an unreachable second app that only `App.test.tsx` exercises — tests validate dead code against a schema the backend no longer matches.

**Fix:** delete the dead tree (App.tsx, LobbyPage, CreateTableModal, tableStore, lib/api, api.schema) or rewrite the test against the live router.

---

### [M-4] Mini-app live lobby duplicates the client with no zod/error handling; analytics values are hardcoded

**Severity:** 🟡 Medium · **Subsystem:** mini-app
**Files:** `frontend/apps/mini-app/src/routes/index.tsx:16-23` (hand-rolled `fetch('/api/lobby')`), `pages/TablePage.tsx:55-61` (`<AnalyticsPanel winProb={74} potOdds={3.2} bestHand="Two Pair" strength={92} />` — `strength` isn't even in the prop type), `vite.config.ts:19-28` (port 5173 vs `--port 5174`; **no `/ws` proxy**)

The server's real `Analytics` payload (`PrivatePayload::Analytics`, actor.rs:926-935) is never rendered anywhere.

**Fix:** reuse the shared api client; render `useGameStore().rooms[id].analytics` when present (fallback skeleton while null); fix the vite port and add the `/ws` proxy.

---

### [B-34] Bot system: hole-card panic, bankroll leaks, double reservation, ledger flush race

**Severity:** 🟡 Medium (cluster) · **Subsystem:** poker bots
**Files:**
- `sb-poker-bots/src/actor.rs:159` + `evaluator.rs:14-16` — `fast_equity(&[], …)` **panics** when `ActionRequired` arrives before hole cards (reconnect/mid-hand subscribe) → bot task dies, its reserved bankroll is never credited.
- `sb-poker-bots/src/lib.rs:110-143` — `fill_table`: `join_table` error leaks the reserved bankroll; the reconnect path (`joined == false`) re-reserves a stack that already exists; `bot_pool.iter().next()` under the 5 s loop can seat the **same bot twice** (check-then-act via `get_player_count`).
- `sb-poker-bots/src/economy.rs:128-146` — `flush_deltas`: `iter().collect()` → `clear()` wipes deltas recorded between the two; a failed `insert_many` drops the batch permanently.
- `sb-bot-handler/src/commands.rs:152-169, 249-259` — `/challenge` resolves the *challenger* by mutable username (or `""`), lets anyone spam-create heads-up tables for arbitrary `@user`s, ignores all notification failures (`let _ = futures::join!(…)`), and treats a 2 s timeout as unknown while the table was actually created (retry storms → duplicate tables).

**Fix sketch:**

```rust
// actor.rs
if self.hole_cards.len() < 2 { return BotDecision::fold(); }          // guard
// lib.rs
if !joined { self.bankroll_manager.credit_bankroll(bot_id, stack).await?; continue; }
let seated = self.seated_flags.entry(bot_id).or_insert(false);
if *seated { continue; } *seated = true;                               // per-bot lock
// economy.rs — atomic drain
let drained: Vec<_> = deltas.iter().map(|e| (*e.key(), *e.value()))
    .map(|kv| { deltas.remove(&kv.0); kv }).collect();                 // remove per key
if let Err(e) = insert_many(&models).await { for kv in &drained { deltas.insert(kv.0, kv.1); } }
```

And in `/challenge`: resolve the challenger by `from.id`, require the invitee's prior opt-in, handle notification `Result`s, and make table creation idempotent per `(challenger, invitee, minute)` key.

---

### [B-35] `start_hand` has no authorization — any authenticated WS client can force-start any room's hand

**Severity:** 🟡 Medium · **Subsystem:** WS handler / actor
**Files:** `backend/crates/sb-ws-handler/src/lib.rs:657-681`; actor `actor.rs:1236-1250`

`InternalCommand::StartHand` carries no user id; nothing verifies the caller is seated (let alone the table owner). Room IDs are UUIDs that leak in broadcasts. Griefing vector: force-start hands on any table to disrupt sit-out players and rebuy flows.

**Fix:** pass `user_id` through; in the actor verify `self.players.contains_key(&user_id)` (and optionally a table-owner flag) before `start_new_hand`.

---

## 6. ⚪ Low Findings

| ID | Finding | Files | Fix |
|---|---|---|---|
| L-1 | `remaining_ms` hardcoded to `30_000` in every `ActionRequired`; timebank spec (issue #011) unimplemented | `game_state.rs:684` | plumb the table's configured action timeout into the payload |
| L-2 | `public_snapshot_for_player` returns `TableId::nil()` | `game_state.rs:744` | pass the real room id (or drop the field) |
| L-3 | Latent stack=0 corruption: `new_stack ?? 0` defeats the parse guard; store overwrites with `Number(0)` | `useGameWebSocket.ts:626-627`, `gameStore.ts:277-281` | pass `undefined` through and skip assignment when `NaN/undefined` on both sides |
| L-4 | `applyActionBroadcast` never updates `current_bet`/`is_folded` — a dropped `TableState` leaves stale visuals | `gameStore.ts:262-297` | update `current_bet` from `amount` and `is_folded` on `FOLD` inside the action reducer |
| L-5 | authGuard saves `redirect` but login always navigates home | `authGuard.ts:15-18`, `login.tsx:65` | `navigate({ to: search.redirect?.startsWith('/') ? search.redirect : '/' })` |
| L-6 | PlayerSpot stats flash ref never updates after flashing → previous deltas re-flash | `PlayerSpot.tsx:657-680` | update `prevStatsRef.current` unconditionally before the early return |
| L-7 | JWT in `localStorage` and in the WS query string (leaks to proxies/logs) | `shared/auth/token.ts:1-10`, `useGameWebSocket.ts:440-444`, `useClubWebSocket.ts:29` | prefer the auth cookie (already supported by the backend `CookieManagerLayer`) or a one-time WS ticket; at minimum keep tokens out of URLs |
| L-8 | `update_chip_balance_with_conn` (direct RMW) coexists with the writer-loop path that lacks the negative-balance check | `user_repo.rs:273-302`, `writer_loop.rs:216-233` | one shared implementation; enforce `chip_balance >= 0` at the SQL level (`CHECK` exists — surface its error properly) |
| L-9 | `run_archival_with_r2` loads all unarchived hands into memory at once | `hand_archive.rs:106-141` | page by `played_at` batches of ~500 |
| L-10 | `bot_bankroll` migration `NOT NULL DEFAULT 0` vs entity `Option<i64>` drift; bot seed inserts `chip_balance: 0` users | `m20260716_bot_system.rs:36-47`, `sb-db-entities/src/user.rs:19`, `main.rs:506-517` | align the entity type; give seed bots a real starting balance |

## 7. Incomplete / Misimplemented Features Inventory

These are features that *exist* in one layer but are incomplete, unreachable, or contradicted in another. Each is referenced by the detailed finding above.

| # | Feature | State | Evidence |
|---|---|---|---|
| 1 | **Payment confirmation loop** | Checkout created, confirmation never happens (webhooks unmounted) | B-4, `main.rs` merges |
| 2 | **Telegram Stars** | Fictional flow: wrong header, wrong payload, no `answerPreCheckoutQuery`, token leaked in "invoice link" | P-2, P-4 |
| 3 | **Entitlement expiry** | `start_expiry_task` never spawned; products' `chips` metadata never used on award | B-4, P-1 |
| 4 | **Anti-cheat engine** | Implemented, never called; only fingerprint ingestion mounted, unvalidated | B-11 |
| 5 | **Notification fanout** | Telegram/Push/Email services implemented, in-memory stub wired in prod | B-10 |
| 6 | **Tournament buy-ins** | Registration bookkeeping only; the designed transactional APIs unused | B-3 |
| 7 | **Tournament antes** | Scheduled & broadcast, never collected | T-8 |
| 8 | **Tournament entrant counts** | `registered: 0` hardcoded; `count_registrations` unused | T-10 |
| 9 | **Tournament registration list** | Frontend expects it, backend never routed it | F-6 |
| 10 | **MTT completion** | Directors never exit; status stuck at `Running`; `remove_actor` dead code | T-7 |
| 11 | **Club-Pro gate** | `is_club_pro_active` = `Ok(true)`; `CheckClubPro` panics the writer if dispatched | F-10, B-16 |
| 12 | **Club ownership** | No owner check on settings/banner routes | F-9 |
| 13 | **Daily missions** | 28/33 types can never progress; `on_share_created` never called | H-3 |
| 14 | **Kick-vote initiation UI** | Handler exists (`_handleKick`), never wired to SeatGrid/PlayerSpot | F-11 |
| 15 | **Sit-out UI** | `sitting_out` never parsed from the wire; `SitOutButton` unreachable | F-11 |
| 16 | **Blinds in client** | Not in the protocol; ActionBar hardcodes BB=10 | F-8 |
| 17 | **Timebank** | `remaining_ms` hardcoded 30 s; issue #011 unimplemented | L-1 |
| 18 | **GDPR export** | Endpoint returns `{hand_history: [], missions: []}` stubs | B-13 |
| 19 | **GDPR deletion status/cancel** | Frontend calls 4 nonexistent routes | F-4 |
| 20 | **Password reset / verify email flows** | Server routes exist; frontend fetches wrong URLs | F-5 |
| 21 | **Web Push** | Three broken client paths; server-side fanout stubbed | F-7, B-10 |
| 22 | **Analytics ingestion** | Server handler 500s (layer order) | B-25 |
| 23 | **Season cards** | Handler queries `Uuid::nil()`; generator retried forever on failure | B-33, B-24 |
| 24 | **Mini-app table view** | Incompatible with current store/protocol; crashes on first message | M-1 |
| 25 | **Mini-app Telegram login** | `initData` never sent; only username/password | M-2 |
| 26 | **Mini-app second app** | Dead React-Router tree tested by `App.test.tsx` | M-3 |
| 27 | **Player analytics HUD** | Server computes real analytics; PWA renders… nothing for it (mini-app hardcodes fake numbers) | M-4, E-5 |
| 28 | **Oracle** | Implemented; note the analytics HUD it feeds was never connected client-side | M-4 |
| 29 | **Table event audit (`/metrics`)** | Public endpoint; README says it shouldn't be | B-26 |
| 30 | **`/challenge` bot flow** | Challenger by mutable username, notification failures ignored, duplicate tables on retry | B-34 |

---

## 8. Performance Summary (consolidated)

| Area | Issue | Fix reference |
|---|---|---|
| Table actor | Monte Carlo (500 iters) per `ActionRequired` on the room's event loop | E-5 |
| Table actor | Broadcast marks dead channels and spawns a doomed `Leave` per message (`user_senders` leak) | B-32 |
| React | 10 Hz full-tree re-render while timers run; unmemoized seat maps; inline callbacks feeding effect deps | F-20 (+F-1, F-11, F-19) |
| React | `AnalyticsPanel` rAF chain leak (only first frame cancelled) — orphaned loops stack per street | — `AnalyticsPanel.tsx:28-46`: keep `rafRef.current = requestAnimationFrame(step)` inside `step` (pattern already correct in `PotBadge.tsx:10-36`) |
| React | Whole-store zustand subscriptions (`useShopStore()`, `useGameStore()` destructures) | F-18, M-4 |
| DB | Hand-history full scans (`INSTR` on unindexed CSV, no LIMIT) | B-21 |
| DB | Single writer task: unbounded channel + 100 ms flush floor on every write | B-15 |
| DB | Archival loads all unarchived hands into memory | L-9 |
| Registry | Room reaper & per-message task churn under leaks | B-31, B-32 |
| WS | No heartbeat; infinite reconnect loops with new-identity effect deps | F-14, F-1 |

---

## 9. Prioritized Remediation Roadmap

**Phase 0 — stop the bleeding (1–2 days).** Ship nothing else before these merge:

1. **E-1/E-1b** side pots + uncalled bets (chip conservation) + **E-3** odd chips.
2. **E-2** partial all-in raise state machine + negative `to_call` guard.
3. **B-1** kick-vote refund theft, **B-2** registry deadlock, **B-5** rebuy refund, **B-6** leave refund durability.
4. **S-1** GDPR identity, **S-2** rate limiter (both one-file fixes), **B-18** buy-in defaulting.
5. **Do NOT enable payments** until P-1 (price ×100), P-2/P-3, P-4/P-5 and the webhook mounting (B-4) all land together.

**Phase 1 — economy integrity (3–5 days).**

6. **B-3** transactional tournament registration with `try_debit_chips`; fix **B-8** crash-recovery journaling; **T-11** prize-pool arithmetic; **T-2/T-3** config validation (payouts, blind schedule, player bounds).
7. **T-1** event filtering + lagged-recv handling; **T-4** entrant-count payouts; **T-5** roster pruning; **T-6** dealer seat; **T-9** rebalancer capacity.
8. **H-1/H-2** mission claim race + streak reset; **B-20** referral atomic claim; **B-19** mission id ordering.
9. Introduce a **chip ledger** (`chip_transactions` append-only) written in the same transaction as every balance change — this turns every remaining economy bug into a detectable anomaly instead of silent drift.

**Phase 2 — auth & abuse (2–3 days).**

10. **S-3/S-4** initData freshness + bot token fail-fast; **S-5** JWT invalidation on password change; **S-6** bot webhook secret; **B-30** single-use reset tokens; **B-29** trusted proxy IP; **B-35** `start_hand` authz; **F-9** club ownership.

**Phase 3 — wire the dead features (3–5 days).**

11. **B-4 + P-1..P-5** complete payment loop with idempotency; **B-10** real notifier; **B-11** anti-cheat wiring; **F-3/F-4/F-5/F-6/F-7** frontend endpoint fixes; **T-8** antes; **T-10** entrant counts; **T-7** director lifecycle; **B-25** analytics route; **B-33** season cards identity.

**Phase 4 — client correctness (3–5 days).**

12. **F-1** pre-actions, **F-2** hero cards, **F-8** blinds protocol, **F-11** kick/sit-out cluster, **F-14** reconnect/heartbeat, **F-15** tournament registration on open, **F-16** multi-room reset, **F-12/F-13/F-19** small fixes.
13. **M-1/M-2/M-3/M-4** mini-app: delete the dead tree, port the PWA hook into `packages/shared`, add initData login.

**Phase 5 — performance & hardening (2–3 days).**

14. **F-20** render cadence; **E-5** async analytics; **B-15/B-21/B-22** writer loop + hand-history queries; **B-9/B-14** leaderboard MV + CORS; **B-12/B-13** GDPR real export; **B-26** metrics lockdown; the L-series.

**Cross-cutting recommendation — contract safety net.** The single largest *class* of bugs found here (F-3, F-4, F-5, F-6, F-7, F-8, M-1) is "client calls a shape or route the server never had". Generate the TS client from the Axum OpenAPI (utoipa) or at minimum add a CI job that type-checks every `apiClient(...)` path against the route table — it would have caught six of these for free.

---

## 10. Verified Non-Findings (checked, correct — don't "fix" these)

1. **Min-raise/max-raise math in the PWA** (`TablePage.tsx:536-543`) is correct *given* the backend's raise-by-delta semantics (`game_state.rs:347-364`); `minRaiseAmount = to_call + min_raise` and `maxRaiseAmount = stack` match `ActionType::AllIn → Raise(stack)`.
2. **`HandResult` clearing `showdownReveal`** is intentional sequencing — the backend reveals, waits ~3 s (`actor.rs:1803-1814`), then broadcasts `HandResult` (`actor.rs:1954`).
3. **WS reconnect re-subscription** — sending only `reconnect` suffices: the handler re-joins all of the user's rooms and re-sends state/hole cards/`ActionRequired` (`ws-handler:240-297`, `actor.rs:883-930`).
4. **WS auth** — the JWT is validated *before* `on_upgrade` (`ws-handler:49-77`); unauthenticated messages can't reach the protocol layer.
5. **`player_action` server-side validation** — turn enforcement (`actor.rs:1448-1461`), min-raise rejection, `ChipAmount::new` rejecting negatives; no negative/overflow chip injection found on the action path.
6. **Seat duplication** — occupied seats and double-joins are rejected (`actor.rs:1038-1047`, join maps to reconnect at `:985-988`).
7. **Stripe signature verification itself** uses the official `stripe_webhook::Webhook::construct_event` (v1 HMAC + replay window) — the bugs are around it, not in it (P-3).
8. **Telegram initData canonicalization** matches the spec (sorted params, `hash` dropped, `\n`-join) — the gap is freshness (S-3), not signature math.
9. **Deck randomness** — CSPRNG via `rand::rng()` (`deck.rs:50-52`); no seed reuse in production paths.
10. **Writer-loop savepoints** — `ROLLBACK TO`/`RELEASE` handled correctly; failed commands don't abort the batch (`writer_loop.rs:504-512`).
11. **JWT algorithm confusion** — `Validation::default()` pins HS256 and validates `exp`; no `aud`/`iss` gaps.
12. **Login user-enumeration/timing** — unknown emails run a real Argon2 dummy verify; `forgot_password` responds identically for unknown users.
13. **DB uniqueness guards** — tournament registrations and club memberships have proper unique indexes (`m20260624:82-88`, `m20260607_000002:74-86`).
14. **Blind scheduler never advances mid-hand** — advance only on `on_hand_completed` (`blind_scheduler.rs:36-49`).
15. **Hand evaluator** (`evaluate.rs`) — straight/flush/wheel detection, kickers (including the wheel's low-ace ordering), full-house/trip/pair tiebreaks all verified correct, including `compare_hands`.

---

## 11. Appendix — Test Gaps That Let These Ship

The repo has decent unit coverage of *happy paths*; every critical bug above lives in an untested invariant. Highest-value new tests, in order:

```rust
// 1. Chip conservation (E-1, E-3): property test — for random hands,
//    sum(player_stacks_after) + pot_paid_out == sum(hand_start_stacks)
#[test]
fn chips_are_never_created_or_destroyed() { /* random multiway all-in scenarios */ }

// 2. Betting invariants (E-2): after any legal action sequence,
//    smallest_bet >= every round_bets[i], to_call >= 0 for the actor player
#[test]
fn bet_level_never_decreases_and_to_call_is_non_negative() { ... }

// 3. Economy closure (B-3, B-5, B-6, B-1): integration test that registers/plays/leaves
//    and asserts ledger_delta == 0 for every user across crashes and restarts
#[test]
fn wallet_matches_chips_in_play_across_restart() { ... }

// 4. Director isolation (T-1): two tournaments + a cash table sharing a player;
//    bust the cash table → no eliminations anywhere
#[test]
fn cash_bust_does_not_eliminate_tournament_player() { ... }

// 5. Webhook idempotency (P-3): deliver checkout.session.completed twice → one award
#[test]
fn stripe_retry_does_not_double_credit() { ... }

// 6. Registry liveness (B-2): reconnect with a dead last-room must not hang join_room_full
#[tokio::test]
async fn unsubscribe_deadlock_regression() { tokio::time::timeout(Duration::from_secs(2), async {
    registry.unsubscribe_from_room(missing, user).await;
}).await.expect("must not deadlock"); }
```

Frontend: add a Vitest for `usePreAction` that simulates 10 re-renders/sec during the 400 ms window and asserts `sendAction` is called exactly once; and a WS contract test that replays recorded `RawWsMessage`s from the backend fixtures against the store.

---

*End of report. 102 findings · 24 critical · 33 high · 35 medium · 10 low · 30-item incomplete-feature inventory · 15 verified non-findings. All file:line references valid at commit `21b7a009`.*



