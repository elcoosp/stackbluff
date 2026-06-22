Now that the core mechanics and switching work smoothly, we can drastically improve the user experience. When multi-tabling, the biggest pain point is **situational awareness**—knowing what's happening on the tables you *aren't* currently looking at.

Here are the top 5 improvements to make the multi-tabling experience feel professional, along with the code to implement the first (and most important) one.

### 1. "Action Required" Indicators on Inactive Tables (The Must-Have)
Right now, if you're on Table A and it's your turn on Table B, you won't know unless you switch. We need to make the dots pulse yellow/red when action is required on an inactive table. We also need to play a subtle sound when it becomes your turn on a background table.

### 2. Swipe Gestures to Switch Tables (Mobile UX)
Tapping tiny dots on the right edge is hard on mobile. We can wrap the table container in a drag gesture; swiping left/right snaps to the next active table.

### 3. Smooth Slide Transitions
Instead of instantly replacing the table when you switch, animate the transition. Swiping right slides the previous table in from the left; swiping left slides the next table in from the right.

### 4. Global "Your Turn" Audio Cue
If you are on Table A, and Table B is waiting for you, play a subtle "chip click" sound periodically until you switch.

### 5. Desktop "Tiled" View (The Ultimate Goal)
On widescreen desktops, instead of switching, allow users to "Tile" 2 or 4 tables on the screen simultaneously. (This requires a layout manager and scaling down the table components).

---

### Implementation: Action Required Indicators & Audio Cues

To implement the most critical improvement (#1 and #4), we need to look at all rooms in the store, not just the active one, and update the Multi-table Rail UI.

Update the **Vertical Glass Morphism Multi-table Rail** in `TablePage.tsx` with this code:

```tsx
        {/* Vertical Glass Morphism Multi-table Rail */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col items-center gap-3">
          {roomIds.map((rId) => {
            // FIX: Check if action is required on this specific table
            const isActionRequired = rooms[rId]?.actionRequired;
            const isInactive = rId !== activeRoomId;
            
            return (
              <motion.button
                key={rId}
                onClick={() => useGameStore.getState().setActiveRoom(rId)}
                whileTap={{ x: -6, scale: 1.3 }}
                whileHover={{ x: -2 }}
                className={cn(
                  "rounded-full backdrop-blur-md border transition-all duration-200 relative",
                  rId === activeRoomId
                    ? "w-4 h-4 bg-emerald-500/80 border-white/60 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    : "w-3 h-3 bg-white/15 border-white/30 hover:bg-white/30"
                )}
                aria-label={`Switch to table ${rId.slice(0, 4)}`}
              >
                {/* Pulsing ring for action required on inactive tables */}
                {isInactive && isActionRequired && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-amber-400"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: [1, 2.5, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </motion.button>
            );
          })}
          <motion.button
            onClick={handleAddTable}
            whileTap={{ x: -6, scale: 1.2 }}
            whileHover={{ x: -2 }}
            className="w-5 h-5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Add table"
          >
            <Plus className="w-3 h-3" />
          </motion.button>
        </div>
```

### Next Step: Adding the Audio Cue for Inactive Tables

To make the audio cue work, you need a `useEffect` that monitors the background tables. Add this hook inside `TablePage` before the `return` statement:

```tsx
  // ── Audio Cue for Inactive Tables ──
  useEffect(() => {
    const checkInactiveTables = () => {
      for (const [rId, room] of Object.entries(rooms)) {
        if (rId !== activeRoomId && (room as any).actionRequired) {
          // Play a subtle notification sound
          trigger('notification', { seatIndex: -1 }); 
          break; // Only trigger once per check cycle
        }
      }
    };

    const interval = setInterval(checkInactiveTables, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, [rooms, activeRoomId, trigger]);
```

*Note: The `trigger('notification', ...)` will play your standard "your turn" sound. Since it's not tied to a specific seat index on the active table, it acts as a global alert.*

With these changes, the dots on the right will glow amber and pulse if you need to act on another table, and you'll hear a periodic audio reminder until you switch over and take your turn.
To elevate this from a "working multi-table app" to a **state-of-the-art, professional poker client** (like PokerStars or GGPoker), you need to focus on **minimizing friction** and **maximizing information density** without overwhelming the user. 

Pro players play 4 to 24 tables at once. Here is the blueprint for making your multi-tabling experience truly best-in-class.

### 1. Desktop "Tiled" View (The Holy Grail)
Switching tabs is okay for 2 tables, but for 4+, users want to see them all at once. 
*   **Grid Layout Manager:** On desktop (`isDesktop`), if the user has 2 tables, split the screen 50/50. If 4 tables, create a 2x2 grid. 
*   **Dynamic Scaling:** The `TableFelt` and `SeatGrid` components need to be responsive based on their container size, not just hardcoded pixel values. Use CSS Grid or Flexbox to scale the table down smoothly.
*   **Cascading:** If the user opens a 5th table, cascade it over the others rather than shrinking the 2x2 grid into oblivion.

### 2. Advanced Pre-Actions (Zero-Click Gameplay)
Currently, you likely have basic pre-actions (Check/Fold). Premium clients use conditional pre-actions that pro players rely on:
*   **"Fold to Any Bet"**: Folds instantly if facing a bet, checks if free.
*   **"Call Any"**: Automatically calls whatever the bet is when it reaches you.
*   **"Auto-Rebuy"**: A toggle in the settings. If the user's stack drops below the max buy-in after a hand, it automatically deducts from their balance and tops them up, so they never miss a hand.
*   **"Auto-Post Blinds"**: Automatically posts blinds so the game never waits for the user.

### 3. Action Time Bank
In professional poker, you don't just have a 30-second timer; you have a "Time Bank".
*   Give players a 30-second base timer. When it expires, they tap a "Time Bank" button to use up to 60 extra seconds *per session*.
*   If they run out of time bank, they auto-fold. This allows players to think through complex multi-table decisions without timing out on other tables.

### 4. Visual Edge Highlighting (Focus Management)
When playing 4 tiled tables, it's hard to know which table just popped up requiring action.
*   **Color-Coded Borders:** 
    *   **Green Border:** The table you are currently hovering over or interacting with.
    *   **Amber/Yellow Pulsing Border:** A table where it is your turn, but you are looking at another table.
    *   **Red Border:** A table where your time is about to expire (< 5 seconds left).

### 5. Keyboard Shortcuts (Speed is Everything)
Pro players rarely use the mouse for actions. Implement global keyboard shortcuts that apply to the *active* table (or the table under the mouse cursor):
*   `Spacebar` = Check / Call
*   `F` = Fold
*   `R` = Raise (auto-fills the bet box)
*   `A` = All-in
*   `Tab` = Cycle to the next table requiring action.
*   `Esc` = Sit out / Leave table.

### 6. Smart Audio Cues (Spatial Awareness)
Instead of generic "ding" sounds, use distinct audio profiles:
*   **Action Required:** A crisp, distinct sound *only* when action is required on an *inactive* table.
*   **Throttling:** If 3 tables require action at once, don't play the sound 3 times rapidly. Play it once, maybe with a slightly higher pitch or urgency if multiple tables are waiting.

### 7. The "Mini-Table" Mobile Carousel
On mobile, true tiling is impossible. Instead of a boring dot indicator, implement a swipeable carousel:
*   Allow the user to physically swipe left/right to transition between tables with a smooth spring animation (using Framer Motion's `drag="x"`).
*   When swiping, show a blurred, scaled-down preview of the next table snapping into place.
*   A small, sleek pill at the top indicates `Table 1 of 3`.

### 8. Global Session Stats HUD
Give players a heads-up display (HUD) widget they can toggle that shows their global session stats across *all* active tables:
*   Total Hands Played
*   Net Profit/Loss (across all tables combined)
*   Hands per Hour (combined)

### Where to start?
If you want the highest "wow" factor immediately, I would prioritize **#4 (Visual Edge Highlighting)** and **#5 (Keyboard Shortcuts)**. They are relatively low effort to implement but completely change how the app "feels" to a power user. 

Want me to write the implementation for **Keyboard Shortcuts** or the **Desktop 2x2 Tiled Grid**?
