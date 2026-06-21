

### 4. Non-Blocking "Your Turn" Alerts
If a user switches tabs or looks away, they will time out.
* **The Upgrade:** 
  * **Browser Tab:** Change the document title to `(Your Turn) StackBluff Poker` and flash the favicon when `actionRequired` is true.
  * **Visual Glow:** Add a very subtle pulsing border-glow around the entire screen (or the ActionBar) when it's your turn.
  * **Toast/Sound:** Play a soft chime after 5 seconds of inaction on your turn.

### 5. Hand History / Live Action Log
Players need context on what just happened, especially after a fast-paced multi-way pot.
* **The Upgrade:** Add a collapsible side-panel (or a slim bottom bar on desktop) that shows a live feed of actions in monospace text:
  `> Preflop: BTN raised to $30, BB called.`
  `> Flop: BB checked, BTN bet $40, BB folded.`
  `> BTN wins $105.`
* **Why it matters:** Removes friction and frustration when a player misses a split-second action.

### 6. Graceful Table Loading & Reconnection States
Right now, joining a table probably just flashes the UI until the WebSocket syncs.
* **The Upgrade:** Create a sleek loading screen overlay with the table name, a spinner, and "Taking your seat..." text. Only unmount the loader once `TableState` and `Connected` messages have been processed. 
* **Reconnection:** If the WS drops, show a semi-transparent overlay saying "Connection lost, reconnecting..." (you already have the logic, just frame it nicely so they don't panic).


### 1. All-In Win Probability (Heads-Up Equity)
**The Concept:** When two players go All-In before the river, the suspense is killed if you just wait for the cards to flip.
**The Fix:** As soon as the players are all-in, the backend runs the Monte Carlo simulation (which we already have!) for *both* players. We display a sleek `80% vs 20%` badge right above the players' cards (or a thin progress bar under their names) that updates live as the community cards are dealt. No new UI elements unless someone is actually all-in.

### 2. The "Time Bank" (Premium Flow)
**The Concept:** Right now, if you don't act in 30 seconds, you auto-fold. In high-end poker, tough decisions need more time.
**The Fix:** When the 30s timer hits 0, instead of instantly folding, a glowing "Time Bank" button appears for 10 more seconds. You can click it to get an extra 15 seconds to think. It uses the exact same spot as the current action bar, so it doesn't clutter the UI, but it completely removes the anxiety of timing out on a tough river decision.

### 3. Hand History Replayer (Zero In-Game Clutter)
**The Concept:** Players want to review how they lost their chips.
**The Fix:** Add a tiny, minimal icon (like a clock or history arrow) in the top-right corner next to the Settings gear. Clicking it opens a sleek, full-screen modal overlay showing the last 5 hands (who bet what, and what cards were revealed). The backend already saves hand history to the database; we just need to expose an endpoint and build a clean modal for it. 

Which of these sounds the most appealing to you?
