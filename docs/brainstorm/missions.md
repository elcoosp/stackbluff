Perfect. Now I have the full StackBluff context. Let me design the mission system specifically for your poker app, respecting the existing architecture, viral goals, anti-frustration constraints, and zero‑merge‑conflict agent ownership.

I’ll produce a **detailed specification** that can be integrated directly into your SRS and Architecture documents.

---

## Mission System Specification for StackBluff

### 1. Core Philosophy (Anti‑Frustration + Viral)

| Principle | Implementation |
|-----------|----------------|
| **Action over outcome** | Missions count attempts, not just wins (e.g., “Get all‑in 3 times” instead of “Win an all‑in”) |
| **Cumulative, not consecutive** | Avoid “win X in a row”; use “win X out of Y attempts” or pure volume |
| **Viral by design** | Missions can be completed *or* skipped by sharing a replay card / referral |
| **No forced play patterns** | Missions never require rare hands (royal flush) or specific opponent behaviour |

### 2. Mission Types (20 at launch, expandable to 30+)

All missions are **daily** (reset at 00:00 UTC). Each player receives exactly 3 random missions per day from the pool below.

| ID | Name | Description | Completion Condition | Viral Variant |
|----|------|-------------|----------------------|----------------|
| M‑01 | The Grinder | Play 20 hands (any stake) | Counts any hand where player sees flop or goes to showdown | – |
| M‑02 | Aggressor | Raise pre‑flop 10 times | Each raise counts (including 3‑bet, 4‑bet) | – |
| M‑03 | Showdown Pro | Go to showdown 5 times | Hand reaches river and cards are shown | – |
| M‑04 | Bluff Catcher | Call a river bet and win | Opponent bet river, you called and won | Share bluff catch replay → +1 extra completion |
| M‑05 | Risk Taker | Go all‑in 3 times (any outcome) | All‑in pre‑flop, flop, turn or river | – |
| M‑06 | Comeback Kid | Win a hand after being all‑in | You were all‑in and won the pot | – |
| M‑07 | Position Player | Win a hand from the button | Winning hand while seated on the button | – |
| M‑08 | Blind Stealer | Win a hand without seeing a flop | You raised pre‑flop, all others folded | – |
| M‑09 | Pot Odds Master | Correctly call a bet where pot odds ≥ required equity (Oracle confirmed) | Oracle analysis must flag “correct call” | Share Oracle result → bonus chips |
| M‑10 | Social Butterfly | Share any replay card | One‑tap share to Telegram / X | Completes mission instantly |
| M‑11 | Club Ambassador | Play 5 hands in a club table | Any hand played in a club | – |
| M‑12 | Referral Rookie | Invite 1 friend who plays 5 hands | Referral link used, new user completes 5 hands | Double reward if shared invite link publicly |
| M‑13 | Early Bird | Play 3 hands before 10:00 UTC | – | – |
| M‑14 | Night Owl | Play 10 hands after 22:00 UTC | – | – |
| M‑15 | Mission Marathon | Complete all 3 daily missions | – | – |
| M‑16 | No Fold’em | See the flop in 5 consecutive hands (no pre‑flop fold) | Consecutive, but counts even if you lose post‑flop | – |
| M‑17 | Oracle Student | Use The Oracle 2 times | Tap Oracle button after any hand | – |
| M‑18 | Streak Saver | If you miss a day, you can share a “Streak Shield” card to preserve streak | Share card → streak not broken (once per week) | **Viral skip** |
| M‑19 | Bluff Artist | Make 2 players fold to your river bet | – | – |
| M‑20 | High Roller | Play 5 hands at the highest stake level available to you | – | – |

### 3. Mission Assignment Logic

To avoid frustration, the system uses **adaptive selection**:

```rust
// Pseudo‑code – owned by Agent 1 (mission_module)
fn select_daily_missions(player: &Player, mission_pool: &[Mission]) -> Vec<Mission> {
    let mut selected = Vec::new();
    let recent_completions = get_last_7_days_completions(player.id);
    
    // 1. Always include one easy volume mission (M‑01, M‑02, M‑03)
    selected.push(pick_easy_volume(recent_completions));
    
    // 2. Include one medium skill mission (M‑05, M‑06, M‑07, M‑08, M‑09, M‑19)
    selected.push(pick_medium_skill(recent_completions));
    
    // 3. Include one viral / social mission (M‑10, M‑12, M‑18)
    selected.push(pick_viral(recent_completions));
    
    // 4. Ensure no mission repeats from the last 3 days for the same player
    selected.retain(|m| !recent_completions.contains(&m.id));
    
    selected
}
```

### 4. Reward Structure

| Completion Type | Reward (Chips) | Additional |
|----------------|----------------|------------|
| Single mission | 500 + (50 × streak_days) | – |
| All 3 missions completed | Bonus 2 000 | Streak counter +1 |
| 7‑day streak | 10 000 + **Streak Shield** (one free skip) | Streak resets after 7 → starts at 1 again |
| Weekly mission (special, appears every Sunday) | 5 000 | Only one weekly mission, replaces one daily |

### 5. Viral Mechanics Inside Missions

**A. Share‑to‑complete (M‑10, M‑12, M‑18)**  
- Player can complete the mission instantly by sharing **any** replay card, invite link, or streak shield card.  
- After share, mission is marked complete and reward granted.  
- Limits: Max 1 share‑complete per day (to avoid spam).

**B. Referral mission boost**  
- If a player shares their referral link and a friend registers, the *referrer’s* current hardest mission gets **auto‑completed** (once per day).  
- This creates a powerful loop: share → friend joins → you skip a grindy mission.

**C. “Miracle Hand” automatic completion**  
- If a player gets a hand that is statistically rare (straight flush, royal flush, quads with pocket pair), all incomplete missions for that day are instantly completed.  
- The system also auto‑generates a share card with text: “I just hit a royal flush and completed ALL my missions!”

### 6. Anti‑Frustration Guarantees

| Problem | Solution |
|---------|----------|
| Mission requires a specific hand that never comes | After 30 hands without progress, mission is replaced with a volume mission (M‑01) for that day only |
| Player disconnected during progress | Progress is saved server‑side every action; no loss |
| Streak broken by travel / vacation | Streak Shield item (earned at 7‑day streak) can be consumed to preserve streak up to 3 days absence |
| Mission too hard for casual player | “Reroll” button (once per day) – replaces one mission with M‑01 |

### 7. Data Model Extensions

Add to existing SQLite schema (owned by Agent 1):

```sql
-- Track daily mission assignments
CREATE TABLE daily_missions (
    user_id UUID NOT NULL,
    assigned_date DATE NOT NULL,
    mission_id VARCHAR(10) NOT NULL,   -- e.g., 'M-01'
    progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    rerolled BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, assigned_date, mission_id)
);

-- Streak history
CREATE TABLE streaks (
    user_id UUID PRIMARY KEY,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_completion_date DATE,
    streak_shield_available INTEGER DEFAULT 0   -- count of unused shields
);

-- Mission definitions (seeded, not modified at runtime)
CREATE TABLE mission_definitions (
    mission_id VARCHAR(10) PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    target_value INTEGER NOT NULL,    -- e.g., 20 for M-01
    reward_chips INTEGER NOT NULL,
    category TEXT NOT NULL,           -- 'easy', 'medium', 'viral', 'weekly'
    is_viral BOOLEAN DEFAULT FALSE
);
```

### 8. Integration with Existing Modules

| Module | Interaction |
|--------|-------------|
| `game_engine` | Emits events: `HandCompleted`, `AllInOccurred`, `BluffSuccess`, `ReferralConfirmed`. Mission module listens via channel. |
| `viral_module` | Provides `share_card()`; mission module calls it when player uses share‑to‑complete. |
| `notification_module` | Sends Telegram / Web Push: “Mission completed!”, “Streak at risk!”, “New daily missions available”. |
| `payment_module` | Season Pass holders get +50% mission rewards (not extra missions). |

### 9. Example User Flow (Daily Engagement)

1. **00:00 UTC** – Player receives 3 missions via notification.
2. **Morning** – Player opens app, sees:  
   - 🃏 Play 20 hands (M‑01)  
   - 💰 Win an all‑in (M‑06)  
   - 📤 Share a replay card (M‑10)
3. Player plays 15 hands, wins one all‑in → M‑06 completed.  
   Still needs 5 hands and a share.
4. Player hits a straight flush → **Miracle Hand** triggers: all missions auto‑completed, streak +1, share card generated.
5. Player shares the royal flush card → M‑10 also satisfied (already completed, but double reward? No, but extra chips for the share).
6. End of day: all 3 completed → bonus 2 000 chips, streak advances to 4.

### 10. Viral Coefficient Impact Estimation

| Viral Mission | Expected shares per user per day | New users per share | Daily K contribution |
|---------------|----------------------------------|---------------------|----------------------|
| M‑10 (share any card) | 0.3 | 0.2 (15% conversion) | 0.06 |
| M‑12 (referral) | 0.1 | 0.5 (invited friend plays 5 hands) | 0.05 |
| M‑18 (streak shield share) | 0.05 | 0.15 | 0.0075 |
| Miracle Hand auto‑share | 0.02 | 0.3 | 0.006 |
| **Total daily K from missions** | | | **~0.12** |

Added to base K of 1.2 from core game, total K ≥ 1.32 – meeting G‑2.

### 11. Performance & Observability

- Mission events are **asynchronous**: `game_engine` sends to `mission_module` via `tokio::sync::mpsc` (same as DB writer pattern).  
- Metrics exposed to Prometheus:  
  - `missions_completed_total{mission_id}`  
  - `missions_share_skips_total`  
  - `streak_length_distribution`  
  - `mission_reroll_usage_total`  
- Alert: if any mission has < 5% completion rate after 1 week → flag for rebalancing.

### 12. Agent Ownership

| Artifact | Owner |
|----------|-------|
| Mission definitions (DB seed) | Agent 1 |
| `mission_module` Rust code | Agent 1 |
| Daily mission selection logic | Agent 1 |
| Frontend mission UI (widget, progress bars) | Agent 2 |
| Viral share trigger integration | Agent 4 (viral_module) |
| Notification triggers | Agent 3 (notification_module) |
| Tests for mission edge cases | Agent 5 |

Interface contract (`src/contracts.rs`):

```rust
pub trait MissionApi: Send + Sync {
    async fn on_hand_completed(&self, player_id: PlayerId, hand_result: &HandResult) -> Result<(), AppError>;
    async fn on_share_created(&self, player_id: PlayerId, share_type: ShareType) -> Result<(), AppError>;
    async fn get_today_missions(&self, player_id: PlayerId) -> Result<Vec<MissionProgress>, AppError>;
    async fn reroll_mission(&self, player_id: PlayerId, mission_id: String) -> Result<Mission, AppError>;
}
```

---

This mission system is now **fully specified**, **viral by design**, **resistant to poker variance**, and **ready to be implemented by your AI agents** without merge conflicts. Would you like me to write the actual Gherkin BDD scenarios for these missions as well?
