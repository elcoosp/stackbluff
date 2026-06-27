## OBS Studio stream overlay – browser source for streamers

**Title:** OBS Studio stream overlay – browser source for streamers  
**Labels:** `frontend, streamer, afk`  
**Blocked by:** #018 (frontend table view)

---

### 📌 Summary

Implement an **OBS Studio overlay** for streamers (SN-018). Streamers can add a browser source to their OBS scene that displays a live poker table with real‑time updates. The overlay is a **dedicated route within the existing React PWA** (`/overlay/:tableId`) that renders the table view with a minimal UI (no header, no navigation, no chrome). This reuses all existing React components (TablePage, SeatGrid, ActionBar, etc.) but strips away anything not needed for streaming.

Key features:

- Shows the table layout (seats, stacks, community cards, pot, action indicator, timer).
- Optionally obfuscates player names (`?obfuscate=true`).
- **Shows hole cards only for the streamer** (if authenticated via a streamer token). Other players' hole cards remain hidden.
- Updates via WebSocket (same game stream).
- Supports CSS customisation via URL parameters (e.g., `?bgOpacity=0.5`, `?hideNames=true`).

The streamer generates a unique overlay token via `POST /profile/overlay-token` and embeds it in the URL: `/overlay/{table_id}?token=...`. The overlay validates the token to identify the streamer and display their hole cards.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Table page (main game view) | `frontend/apps/pwa/src/pages/TablePage.tsx` |
| Game components | `frontend/apps/pwa/src/components/game/` (TableFelt, SeatGrid, ActionBar, etc.) |
| Overlay route | `frontend/apps/pwa/src/routes/overlay.$tableId.tsx` (new) |
| WebSocket hook | `frontend/apps/pwa/src/hooks/useGameWebSocket.ts` |
| Token generation (backend) | `POST /profile/overlay-token` (add endpoint) |
| WebSocket overlay mode | Extend `ws_handler` to accept `?mode=overlay&token=` and filter data. |

---

### 🔧 What to build

#### 1. Backend – overlay token generation

- Add endpoint: `POST /profile/overlay-token`
- Authentication required (via `AuthUser`).
- Generate a short‑lived JWT (e.g., 7 days) with claims:
  - `sub`: user_id
  - `aud`: 'overlay'
  - `exp`: 7 days from now
- Return `{ token: "..." }`.

#### 2. Backend – WebSocket overlay mode

- Extend the WebSocket handler to accept a `?mode=overlay` query parameter.
- When connecting with an overlay token (instead of a normal auth token), the server:
  - Validates the JWT (using the same secret).
  - Identifies the streamer’s user ID.
  - Subscribes to the game updates for the given `table_id`.
  - Sends **only public** table state (no hole cards except for the streamer’s own hand).
  - Obfuscates other players' names if `?obfuscate=true` is set (via the same WebSocket connection or by having the frontend mask them).

#### 3. Frontend – overlay route (`/overlay/:tableId`)

- Create a new route in the PWA that renders a modified version of `TablePage`.
- The overlay page should:
  - **Remove all chrome** (Header, sidebar, navigation, any UI that is not the table itself). This can be done by conditionally hiding components based on the route.
  - Use the same `useGameWebSocket` but with `mode: 'overlay'` and the overlay token.
  - Parse URL parameters (`obfuscate`, `bgOpacity`, `hideNames`, etc.) and apply them to the table rendering.
  - Render the table at full viewport (or a fixed size suitable for OBS).
- The page should be responsive to fit OBS browser source dimensions (use relative units; the container fills the viewport).

#### 4. Frontend – WebSocket integration for overlay

- Extend `useGameWebSocket` to accept an `overlayToken` and `mode: 'overlay'`.
- The WebSocket connection will send the token; the server will filter messages accordingly.
- The hook will handle the same message types (`TableState`, `ActionBroadcast`, etc.) but the data will already be filtered by the server.

#### 5. CSS customisation via URL parameters

- Support the following URL parameters (applied via CSS variables or conditional rendering):
  - `bgOpacity` (0–1) – background opacity of the table felt.
  - `hideNames` (true/false) – hide all player names (useful for privacy).
  - `cardSize` (small/medium/large) – scale of community cards.
  - `showTimer` (true/false) – show/hide the action timer.
  - `obfuscate` (true/false) – obfuscate player names (replaces with "Player 1", etc.).
- These parameters are read in the overlay route and passed down to the relevant components.

#### 6. Token validation and fallback

- If no token is provided, the overlay works in **spectator mode** (no hole cards).
- If the token is invalid or expired, show an error message in the overlay (e.g., “Invalid token”).

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] `POST /profile/overlay-token` returns a valid JWT for authenticated users.
  - [ ] WebSocket endpoint accepts `?mode=overlay&token=...` and validates the token.
  - [ ] Overlay WebSocket connection only sends public data; hole cards are only sent for the streamer’s own hand.
  - [ ] Player names are obfuscated when `?obfuscate=true` is set (server‑side or frontend masking).
- [ ] **Frontend:**
  - [ ] `GET /overlay/:tableId` renders the table with no header/navigation (minimal chrome).
  - [ ] The overlay updates in real‑time (< 1s delay) via WebSocket.
  - [ ] The streamer’s hole cards are displayed (when token is valid).
  - [ ] Other players' hole cards are hidden (shown as card backs).
  - [ ] CSS customisation parameters (`bgOpacity`, `hideNames`, `cardSize`, `showTimer`) work correctly.
  - [ ] The overlay fits OBS browser source size without scrolling (scaled to fill the viewport).
- [ ] **General:**
  - [ ] The overlay does not leak any sensitive information (e.g., other players’ hole cards).
  - [ ] The token expires after a reasonable time (7 days) and can be renewed.

---

### 🔗 Blocked By

- **#018** – The frontend table view (TablePage and components) must be complete and stable, so we can reuse it for the overlay.

---

### 🧪 Testing Notes

- **Manual testing with OBS**:
  - Generate a token, add a browser source to OBS, enter the overlay URL, and verify the table appears.
  - Join a game as the streamer and verify that only your hole cards are visible.
  - Change URL parameters (e.g., `?bgOpacity=0.3`) and see the overlay update.
- **Automated tests**:
  - Unit test the token generation and validation.
  - Integration test the WebSocket overlay mode (mock a player and verify the data sent to the overlay).
- **Performance**:
  - The overlay should consume minimal CPU (< 5% in OBS). Use efficient React updates (memoization, avoid unnecessary re-renders).

---

### 📝 Implementation Hints

- **Reusing TablePage**: The existing `TablePage` can be adapted by conditionally rendering the Header and other chrome. We can add a `useLocation` check to hide these elements when the route is `/overlay/*`.
- **WebSocket mode**: Pass the overlay token and mode to `useGameWebSocket`. The server must support this; if not, we can add a flag to the WebSocket connection to request only public data.
- **CSS variables**: Use CSS custom properties to apply background opacity and other styles from URL parameters.
- **OBS compatibility**: OBS browser source uses Chromium; ensure the page works in a headless browser (no `localStorage` or cookies required for the overlay; use URL params only).
- **Security**: The overlay token should be treated as a secret – streamers should not share it publicly. The token grants only read‑only access to the table (no actions can be taken).
