We have built a very solid, visually striking foundation. The showdown sequence, analytics, and glass aesthetics are looking great. To elevate this from a "good" poker game to a **best-in-class, premium UX** (comparable to modern apps like ClubGG or PokerStars), here are the exact features and polish items you should implement next, ranked by impact:

### 1. Player-to-Pot Bet Animations (Visual Immersion)
Right now, when a player bets, their stack number decreases and the pot number increases. 
* **The Upgrade:** Add a `BetAnimationLayer` (similar to your `ChipAnimationLayer`) that listens to `ActionBroadcast`. When a player bets/calls/raises, spawn 3-4 chips that fly from the player's seat to the center pot, *then* update the pot number upon chip arrival. 
* **Why it matters:** It creates a tangible, physical connection between the player's stack and the pot, making the game feel incredibly responsive and real.

### 2. Position Badges (BTN, SB, BB, UTG, etc.)
I see you have a `position_badge` field in your types, and a `D` for the dealer, but standard poker UIs show exact positions. 
* **The Upgrade:** Have the backend calculate and send standard positions (BTN, SB, BB, UTG, MP, CO) in the `TableState`. Display these as small, subtle badges next to the player's name.
* **Why it matters:** Serious players rely heavily on positional awareness. Having this visible natively in the UI builds immense trust and playability.

### 3. Audio & Haptic Feedback (The "Feel")
A silent poker table feels dead. Audio provides immediate subconscious confirmation of actions.
* **The Upgrade:** Create an `AudioManager` hook. Trigger sounds on specific WebSocket events:
  * `ActionBroadcast`: Card flick sound for check/call, heavier chip clatter for raises.
  * `ShowdownReveal`: A subtle suspense sound, followed by a triumphant chime for the winner.
  * `YourHoleCards`: A soft card deal sound.
  * *Mobile only:* Haptic vibration (navigator.vibrate) when it becomes your turn or when you win the pot.
* **Why it matters:** It’s the single biggest difference between a "web demo" and a "product".

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

### 7. Time Bank & Auto-Fold Warnings
Your `TimerBar` is excellent, but users need a buffer.
* **The Upgrade:** If the timer runs out, instead of instantly folding, give them a 5-second "Time Bank" that glows red, or trigger a very obvious screen pulse at the 5-second remaining mark so they know they are about to lose their hand.

### Recommended Implementation Order:
1. **Position Badges** (Backend + Frontend - quickest win for usability).
2. **Tab Title/Alerts** (Frontend only - takes 10 minutes, huge UX win).
3. **Audio Manager** (Frontend only - takes a few hours, massive sensory upgrade).
4. **Bet Chip Animations** (Frontend only - takes a few hours, huge visual upgrade).
5. **Hand History Log** (Backend stream + Frontend panel).

Would you like to start with the **Audio Manager** or the **Player-to-Pot Bet Animations**? I can write the code for either right now.
