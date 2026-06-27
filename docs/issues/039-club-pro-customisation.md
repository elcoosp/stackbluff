## Club Pro customisation – banner, chip preset, felt colour

**Title:** Club Pro customisation – banner, chip preset, felt colour  
**Labels:** `backend, frontend, clubs, payments, afk`  
**Blocked by:** #033 (shop – Club Pro purchase flow), #034 (club management UI scaffold)

---

### 📌 Summary

Implement **Club Pro customisation** features (REQ-FUNC-045, SN-015). Club Pro subscribers can customise their club’s visual identity across the entire app:

- **Banner image** – uploaded to CDN and displayed on the club page header.
- **Chip preset** – choose from 5 predefined chip designs (frontend‑defined presets, stored by ID).
- **Felt colour** – choose from 8 predefined colours (CSS hex codes), applied to all tables associated with the club.

The customisation settings are stored in the `clubs.pro_settings` JSON column. Only Club Pro subscribers can modify these settings; non‑Pro owners see a locked UI with an upgrade call‑to‑action. Changes are propagated in real time to all users currently seated at any table belonging to the club via WebSocket broadcasts.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Club entity | `backend/crates/sb-db-entities/src/clubs.rs` (has `pro_settings_json: Option<ClubProSettings>`) |
| Club repository | `backend/crates/sb-db-repos/src/club_repo.rs` (ClubRepoImpl) |
| Club service | `backend/crates/sb-club/src/service.rs` (ClubServiceImpl) – needs update method |
| REST endpoints | `backend/crates/sb-rest-router/src/club_routes.rs` (or `sb-club/src/handlers.rs`) |
| Payment/subscription | `backend/crates/sb-payment/src/service.rs` – need a way to check Club Pro status (`users.club_pro_expires_at` or a separate subscription table). Assume #033 added a column. |
| WebSocket (backend) | `backend/crates/sb-table-registry/src/connection_broker.rs` – broadcast to club rooms |
| Frontend club settings | `frontend/apps/pwa/src/components/club/SettingsTab.tsx` (from #034) |
| Frontend shop | `frontend/apps/pwa/src/pages/ShopPage.tsx` – upgrade CTA links |
| CDN upload | Use existing R2 infrastructure (`hand_archive` – we can reuse `RealR2::put_object`). |

---

### 🔧 What to build

#### 1. Backend – update club settings endpoint

- Add or extend `PATCH /clubs/{id}/settings` (or reuse the existing `PATCH /clubs/{id}` if present).
- Request body (partial):
  ```json
  {
    "banner_url": "https://cdn.example.com/club_banner.png",
    "chip_preset_id": 2,
    "felt_color": "#1a6b42"
  }
  ```
- Validate:
  - `chip_preset_id` must be 1–5.
  - `felt_color` must be one of the 8 predefined colours (hardcode a list of accepted values, e.g., `["#1a6b42", "#2d7a5a", ...]`).
  - `banner_url` must be a valid HTTPS URL (if provided; can be null to remove).
- **Authorization**: only the club owner, and only if they have an **active Club Pro subscription**.
  - Check `users.club_pro_expires_at` (added by #033) against `Utc::now()`.
  - If not active, return `403 Forbidden` with a message like “Club Pro subscription required”.
- Update the `pro_settings_json` column in the `clubs` table (merge with existing fields).
- After update, **broadcast** the new settings to all users connected to any table belonging to this club (via `ConnectionBroker`).

#### 2. WebSocket broadcast – `club.theme_updated`

- In the `club_repo` or service, after saving the settings, trigger a broadcast.
- Use the `ConnectionBroker` to send a message to all rooms that are associated with the club. We need to know which rooms belong to the club; the `Registry` maintains `table_rooms` mapping, and each table has a `club_id`. We can:
  - Query the `tables` table to find all table IDs for the club.
  - For each table, get its `room_id`s (via `Registry`).
  - Broadcast a message `{ type: 'club_theme_updated', settings: { banner_url, chip_preset_id, felt_color } }` to all subscribers of those rooms.
- This ensures all players at the club’s tables see the changes within seconds.

#### 3. Frontend – Club Pro settings UI

- In the club settings tab (from #034), check if the user has an active Club Pro subscription (from `authStore` or a dedicated query).
- If **Pro**: display the customisation controls:
  - **Banner upload**: file input (accept image) that uploads to a CDN endpoint (or directly to R2 via signed URL; for MVP, we can implement a simple upload API in the backend). After upload, the URL is sent to the `PATCH` endpoint.
  - **Chip preset picker**: show 5 chip design previews (small images). The user selects one; the selection is stored as an integer (1–5).
  - **Felt colour picker**: show 8 swatches; clicking selects the colour (store as hex).
- If **not Pro**: show a locked panel with an “Upgrade to Club Pro” button that links to the shop page (`/shop`) with the Club Pro product preselected.
- **Live preview**: For chip and felt changes, the frontend can apply the change instantly in the preview area (mock table) even before saving, to give immediate feedback. The actual save happens via the `PATCH` endpoint.

#### 4. Frontend – applying club theme to tables

- In the `TablePage` (or the game UI), listen for the WebSocket `club_theme_updated` event.
- When received, update the table’s visual theme:
  - **Felt colour**: change the `TableFelt` background gradient (CSS) to the selected colour.
  - **Chip preset**: change the chip image or CSS styling of chips (may require updating the `AnimatedChip` component to use the preset).
  - **Banner**: not displayed on the table, but on the club page header.
- The theme should also be applied when a user first joins a club table (load the settings from the club and apply).

#### 5. CDN upload (backend)

- Create a simple upload endpoint `POST /clubs/{id}/banner` that accepts a multipart file, uploads it to R2 (using `RealR2`), and returns the public URL.
- The frontend can call this endpoint first, then send the URL in the settings update.

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] `PATCH /clubs/{id}/settings` accepts `banner_url`, `chip_preset_id`, `felt_color` and updates the `pro_settings_json`.
  - [ ] Only the club owner with an active Club Pro subscription can modify settings; others receive `403`.
  - [ ] Invalid values (e.g., preset ID out of range, invalid colour) return `400 Bad Request`.
  - [ ] After a successful update, a WebSocket message `club_theme_updated` is broadcast to all users at any table belonging to the club.
- [ ] **Frontend:**
  - [ ] Club settings page shows the customisation UI **only** for Club Pro subscribers; non‑Pro owners see an upgrade CTA.
  - [ ] The banner uploader works (file picker, preview, upload, and save).
  - [ ] The chip preset picker shows 5 options and allows selection.
  - [ ] The felt colour picker shows 8 swatches and allows selection.
  - [ ] Changes made in the UI are saved to the backend and reflected immediately in the preview.
  - [ ] When a theme change is broadcast, all active tables in the club update their felt colour and chip design within 10 seconds (tested with two tabs).
- [ ] **General:**
  - [ ] The customisation does not affect non‑club tables.
  - [ ] No performance degradation due to WebSocket broadcasts (tested with 50+ connected users).

---

### 🔗 Blocked By

- **#033** – The Club Pro purchase flow must be complete, including setting `users.club_pro_expires_at` and providing a way to check subscription status.
- **#034** – The club management UI scaffold must exist (tabs, settings page) so we can add the customisation controls.

---

### 🧪 Testing Notes

- **Unit tests** for the settings update endpoint (validation, permission checks).
- **Integration tests** for the WebSocket broadcast (mock the broker and verify message sent).
- **Frontend tests** (React Testing Library) for the customisation UI (rendering, selection, API calls).
- **E2E tests** (Playwright):
  - Club Pro owner changes felt colour and sees it reflected on a club table in another browser tab.
  - Non‑Pro owner sees upgrade prompt and cannot save changes.

---

### 📝 Implementation Hints

- **Club Pro check**: #033 should have added a `club_pro_expires_at` column to the `users` table. Use that.
- **WebSocket broadcast**: The `ConnectionBroker` is already used for tournament broadcasts. For club theme updates, we can add a dedicated method `broadcast_to_club(club_id, message)` that:
  - Queries `tables` for all tables with that `club_id`.
  - For each table, finds all active `room_id`s via `Registry`.
  - Broadcasts to those rooms.
- **Frontend theme application**: Store the club theme in a React context or Zustand store. When a user joins a table, fetch the club settings via `GET /clubs/{id}` and apply them. The WebSocket listener updates the store when changes occur.
- **Chip presets**: Since chip designs are frontend‑defined, we can create a mapping from preset ID to CSS styles or SVG templates. The `AnimatedChip` component can read the current club preset from context.
- **Felt colour**: The `TableFelt` component already uses a gradient. We can pass the colour as a prop, e.g., `<TableFelt customColor={clubTheme.felt_color} />`.

---

This ticket provides a complete, self‑contained specification for implementing Club Pro customisation, with clear handoffs between backend and frontend, and aligned with the existing codebase.
