## Spectator mode – watch tables and live chat

**Title:** Spectator mode – watch tables and live chat  
**Labels:** `backend, frontend, websocket, afk`  
**Blocked by:** #018 (frontend table view), #021 (notification routing for chat)

---

### 📌 Summary

Implement **spectator mode** (SN-016) allowing users to watch active poker tables without joining the game. Spectators receive a filtered, read‑only view of the table (no hole cards, only public info) and can participate in a live chat with other spectators (and optionally players).

Key features:

- **Public WebSocket endpoint**: `wss://host/ws/spectate/{table_id}` – no authentication required.
- **Filtered table state**: Spectators see all public data (community cards, pot, stacks, bets, action indicators, player names) but **no hole cards**.
- **Live chat**: Spectators can send chat messages (rate‑limited: 5 messages per 10 seconds). Chat is broadcast to all spectators and (if enabled by the player) to players at the table.
- **Max spectators**: Configurable limit per table (default 100); new connections rejected when full.
- **Frontend**: Spectator page (`/spectate/{table_id}`) with the same table rendering as the main game (but no action buttons) and a chat panel.
- **Player opt‑out**: Players can disable chat in their settings; when disabled, chat messages are not delivered to them.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| WebSocket handler (server) | `backend/crates/sb-ws-handler/src/lib.rs` (ws_handler) |
| Table registry | `backend/crates/sb-table-registry/src/registry.rs` (Registry) |
| Connection broker | `backend/crates/sb-table-registry/src/connection_broker.rs` (broadcast to rooms) |
| Notification service | `backend/crates/sb-contracts/src/notification_api.rs` (for chat message delivery) |
| Frontend table view | `frontend/apps/pwa/src/pages/TablePage.tsx`, `components/game/` |
| Spectator page | `frontend/apps/pwa/src/pages/SpectatePage.tsx` (new) |
| User settings | `frontend/apps/pwa/src/pages/SettingsPage.tsx` (add `chat_enabled` toggle) |

---

### 🔧 What to build

#### 1. Backend – new WebSocket endpoint for spectators

- Add a new WebSocket route: `/ws/spectate/{table_id}` (or extend the existing `/ws/game` with a `?mode=spectate` flag).
- This endpoint **does not require authentication** – any user (including anonymous) can connect.
- On connection:
  - Validate the `table_id` exists and is active.
  - Check the current spectator count for that table; if ≥ `MAX_SPECTATORS` (default 100), reject the connection with a `429` error.
  - Add the spectator to the room’s broadcast list (via `ConnectionBroker`).
- On message from spectator:
  - Only accept `chat.message` messages (ignore game actions).
  - Apply rate limiting: 5 messages per 10 seconds per spectator (store timestamps in memory).
  - Broadcast the chat message to **all subscribers** of that room (both spectators and players who have chat enabled).

#### 2. Backend – filtered table state for spectators

- The WebSocket handler for spectators should subscribe to the same table events but filter out:
  - **Hole cards**: never send `YourHoleCards` or any private card data.
  - **Action Required**: never send `ActionRequired` (spectators cannot act).
  - **Private payloads**: strip any `PrivateMessage` with `type: 'your_hole_cards'` or `analytics`.
- Only send:
  - `TableState` (public info: community cards, pot, stacks, bets, player names, action indicators).
  - `ActionBroadcast` (public actions: who folded/called/raised).
  - `ShowdownReveal` (when cards are revealed, show all hole cards – this is public).
  - `HandResult` (winners, pot).
  - `ChatMessage` (if implemented as a separate message type or within `RoomMessage`).

#### 3. Backend – chat message handling

- Add a new `RoomMessage` variant: `ChatMessage { user_id, user_name, message, timestamp }`.
- When a spectator sends a chat message:
  - Validate the message length (max 500 chars).
  - Apply rate limiting.
  - Broadcast the message to all subscribers of the room.
- For players, only deliver chat messages if their `chat_enabled` setting is `true` (store this in `users` table as `chat_enabled` boolean, default `true`). This requires adding a column and updating the user settings API.

#### 4. Backend – spectator count

- The `Registry` should track the number of active spectators per room (separate from players).
- Expose this count via the lobby API so the frontend can display it on table cards: `GET /tables` should include `spectators` count.

#### 5. Frontend – spectator page (`/spectate/{table_id}`)

- Create a new page that renders the same table view as `TablePage`, but:
  - **No ActionBar** (spectators cannot play).
  - **No pre‑action or buy‑in dialogs**.
  - **Add a chat panel** (collapsible) on the side or bottom (depending on layout).
  - The chat panel shows recent messages, an input field, and a send button.
- The page should work for both logged‑in and anonymous users.

#### 6. Frontend – chat panel

- The chat panel should:
  - Display messages with user name and timestamp (relative time).
  - Auto‑scroll to the latest message.
  - Allow sending messages (rate‑limited by the backend; frontend should also debounce).
  - Show a “You are spectating” indicator and the spectator count.
- The chat panel can be toggled (show/hide) to not obstruct the table view.

#### 7. Frontend – lobby integration

- In the lobby page (`/lobby`), display the current spectator count for each table (e.g., “👁️ 12 watching”).
- Add a “Spectate” button next to the “Join” / “Observe” buttons.

#### 8. Frontend – player chat opt‑out

- In the user settings (profile), add a toggle: **“Enable chat messages”**.
- When disabled, the backend will not deliver chat messages to that player.
- The frontend should not show the chat panel for players who have disabled chat (or it can show a message: “Chat is disabled in your settings”).

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] A public WebSocket endpoint `/ws/spectate/{table_id}` exists and does not require authentication.
  - [ ] Spectators receive filtered table state (no hole cards, no action required).
  - [ ] Chat messages are rate‑limited (5 per 10 seconds) and broadcast to all room subscribers.
  - [ ] Players with `chat_enabled = false` do not receive chat messages.
  - [ ] Max spectators per table is enforced (default 100).
  - [ ] The spectator count is exposed via the lobby API.

- [ ] **Frontend:**
  - [ ] The spectator page (`/spectate/{table_id}`) renders the table with no action buttons.
  - [ ] A chat panel is visible and functional (sends/receives messages).
  - [ ] Messages appear within 500ms (tested with a local network).
  - [ ] The lobby shows spectator counts for each table.
  - [ ] Players can disable chat in settings; chat messages are not delivered to them.
  - [ ] The chat panel auto‑scrolls and handles long messages gracefully.
  - [ ] The page works for both logged‑in and anonymous users.

---

### 🔗 Blocked By

- **#018** – The frontend table view (TablePage and components) must be complete to reuse for the spectator page.
- **#021** – Notification routing must support chat message broadcasting (can be extended from the existing NotificationService).

---

### 🧪 Testing Notes

- **Unit tests** for rate limiting and message filtering.
- **Integration tests** for the WebSocket endpoint (connect as spectator, verify no hole cards).
- **E2E test** (Playwright): Open a table, spectate from another browser, send a chat message, verify it appears on both sides.
- **Performance test**: Connect 100 spectators to a table and measure CPU/memory usage.

---

### 📝 Implementation Hints

- **Reuse TablePage**: The spectator page can share the same `TablePage` component with a prop `mode: 'spectate'` that conditionally hides the ActionBar and shows the chat panel.
- **WebSocket connection**: The spectator WebSocket can be a separate connection or reuse the same connection with a different token/mode. Using a separate endpoint is cleaner for access control.
- **Chat storage**: Chat messages do not need to be persisted; they are ephemeral (in‑memory only). If we want history, we could store the last 50 messages in memory per room.
- **Player chat opt‑out**: Add `chat_enabled` column to `users` table with default `true`. Extend the user settings API to update it.
- **Spectator count**: Track this in the `Registry` with an `AtomicU32` per room. Increment on connect, decrement on disconnect.

---

This ticket provides a complete, self‑contained specification for spectator mode with live chat, leveraging the existing table rendering and WebSocket infrastructure.
