## Club management UI – tournament scheduling and basic settings

**Title:** Club management UI – tournament scheduling and basic settings  
**Labels:** `frontend, clubs, afk`  
**Blocked by:** #006 (frontend scaffold), #029 (backend club tournament endpoints)

---

### 📌 Summary

Build the **club management interface** for the PWA and Mini App. Club owners and members can view club details, schedule tournaments, view the leaderboard, and configure club settings. The UI consists of a club page (`/clubs/:id`) with three tabs: **Leaderboard**, **Tournaments**, and **Settings**.

- **Tournaments tab**: Allows club owners to schedule new tournaments with a date/time picker, blind structure template dropdown, max players (10–500), and buy‑in (chips). Also displays upcoming tournaments with register/unregister buttons for members.
- **Leaderboard tab**: Shows the club leaderboard (rank, user, weekly XP) with pagination by division (500 members per division).
- **Settings tab** (owner only): Edit club name, upload a logo (to CDN), and link a Telegram group (sets `telegram_group_id` via API). For Club Pro subscribers (from #033), additional customisation options (banner, chip preset, felt colour) appear as placeholders (Wave 4 ready).

The UI must be responsive, using the existing dark theme and components (`GlassPanel`, `LiquidMetalButton`, `Dialog`, `Card`, etc.). Real‑time updates via WebSocket and toast notifications should provide feedback for registration/unregistration and tournament creation.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Club page (new) | `frontend/apps/pwa/src/pages/ClubPage.tsx` (create) |
| Routing | `frontend/apps/pwa/src/routes/clubs.$id.tsx` (create) |
| Club tabs (Leaderboard, Tournaments, Settings) | `frontend/apps/pwa/src/components/club/` (create) |
| Tournament scheduling form | `frontend/apps/pwa/src/components/club/ScheduleTournamentDialog.tsx` (create) |
| Leaderboard component | Reuse/extend `frontend/apps/pwa/src/components/Leaderboard.tsx` or create `ClubLeaderboard.tsx` |
| API client | `frontend/apps/pwa/src/lib/api.ts` (uses `@stackbluff/shared/api/client`) |
| State management | `frontend/apps/pwa/src/stores/authStore.ts` (user, club ownership), create `clubStore` if needed |
| UI components | `@stackbluff/shared/ui/GlassPanel`, `LiquidMetalButton`, `Dialog`, `Card`, `Input`, `Select`, `DatePicker` (from shadcn or custom) |
| Toast notifications | `sonner` (already used) |
| WebSocket | `useGameWebSocket` (or a dedicated hook) can be extended to listen for `club.updated` events |

---

### 🔧 What to build

#### 1. Backend API contract (assumed from #029)

We expect the following endpoints to be available:

- `GET /clubs/:id` – returns club details: `{ id, name, logo_url, telegram_group_id, is_owner, pro_settings?, members_count }`
- `GET /clubs/:id/leaderboard?division=1` – returns `{ entries: [{ rank, user_id, weekly_xp }], total_members, total_divisions, current_division }`
- `GET /clubs/:id/tournaments` – returns list of tournaments (scheduled, running, completed) with registration status for the current user.
- `POST /clubs/:id/tournaments` – schedule a new tournament (owner only). Request body: `{ name, max_players, buy_in, scheduled_start, blind_schedule_id }` (or embed schedule).
- `POST /tournaments/:id/register` – register current user for a tournament.
- `DELETE /tournaments/:id/register` – unregister.
- `PATCH /clubs/:id` – update club settings (owner only). Request body: `{ name?, logo_url?, telegram_group_id?, pro_settings? }`

#### 2. Club page and routing

- Add a new route `/clubs/$clubId` (TanStack Router) that renders `ClubPage`.
- The page should fetch club data on mount and display a tabbed interface.
- Use the `useParams` hook to get the `clubId` from the URL.

#### 3. Tabs structure

- **Leaderboard tab**:  
  - Show the club leaderboard with columns: Rank, User (avatar + name), Weekly XP.  
  - Implement pagination by division (show buttons for next/previous division).  
  - Use a `Card` or `GlassPanel` for the table.  
  - The leaderboard should auto‑refresh every 5 minutes (or after a tournament result) – using React Query’s `refetchInterval`.  
  - Display the current division and total divisions.

- **Tournaments tab**:  
  - Show a list of upcoming tournaments (status `Registering` or `Scheduled`).  
  - Each tournament card shows: name, date/time, buy‑in, max players, current registrations.  
  - For the club owner (or members with permission), display a **“Schedule Tournament”** button that opens a dialog.  
  - For each tournament, show a **Register**/**Unregister** button depending on the user’s registration status.  
  - After registration/unregistration, show a toast and refetch the list.

- **Settings tab** (visible only to the club owner):  
  - Form fields: Club name (text input), Logo upload (file input with preview), Telegram group ID (text input).  
  - On submission, call `PATCH /clubs/:id` and show a success toast.  
  - If the user has Club Pro active (from #033), show additional customisation fields:  
    - Banner image upload (placeholder)  
    - Chip design preset (dropdown, placeholder options)  
    - Felt colour (colour picker, placeholder)  
  - These fields are saved but not yet applied to the game UI (Wave 4).

#### 4. Tournament scheduling dialog

- When the owner clicks **“Schedule Tournament”**, open a `Dialog` with:  
  - Tournament name (text input).  
  - Date & time picker (use a datetime picker component).  
  - Blind structure template dropdown (populated from a `GET /blind-templates` endpoint, or a predefined list).  
  - Max players (number input, range 10–500).  
  - Buy‑in chips (number input).  
- On submission, call `POST /clubs/:id/tournaments`.  
- On success, close the dialog, show a toast, and refetch the tournament list.

#### 5. Real‑time updates

- Extend the WebSocket connection (or use a separate channel) to listen for `club.updated` events (e.g., when a tournament is created, a member registers, or XP changes).  
- When such an event is received, invalidate the relevant React Query cache (e.g., `queryClient.invalidateQueries({ queryKey: ['club', clubId] })`).  
- For leaderboard updates, the backend will trigger a refresh of the materialised view; the frontend should refetch periodically (or listen for a `leaderboard.refreshed` event).

#### 6. Error handling

- Show user‑friendly error messages via toast for network failures or permission errors.  
- If the user is not a club member, redirect them to the club’s public page (or show a “Join Club” button – this is out of scope for now, but can be a future enhancement).

---

### ✅ Acceptance Criteria

- [ ] **Club page** is accessible at `/clubs/:id` and shows the club name, logo, and member count.  
- [ ] **Leaderboard tab** displays the club’s leaderboard with rank, user, and weekly XP, paginated by division (500 members per division).  
- [ ] **Tournaments tab** lists upcoming tournaments with registration status.  
- [ ] **Club owner** can schedule a tournament using the dialog in under 2 minutes; the tournament appears immediately in the list.  
- [ ] **Members** can register and unregister for tournaments; a toast confirmation and a notification are shown.  
- [ ] **Settings tab** (owner only) allows updating the club name, logo, and Telegram group ID.  
- [ ] For Club Pro subscribers, additional customisation options (banner, chip preset, felt colour) are displayed (as placeholders) and can be saved.  
- [ ] After any tournament result, the leaderboard updates within 5 minutes (via periodic refetch or WebSocket).  
- [ ] The UI is fully responsive (mobile-first), uses existing dark theme and components.  
- [ ] All forms include validation (e.g., required fields, positive numbers).  
- [ ] Toast notifications are used for all success/error messages.

---

### 🔗 Blocked By

- **#006** – Frontend scaffold (routing, state, UI components) must be in place.  
- **#029** – Backend club tournament endpoints (scheduling, registration, leaderboard) must be implemented.

---

### 🧪 Testing Notes

- **Unit tests** for the club store, leaderboard pagination, and form validation.  
- **Integration tests** for the scheduling dialog (mocking API calls).  
- **E2E tests** (Playwright):  
  - Owner schedules a tournament and sees it in the list.  
  - Member registers and sees the button change to “Unregister”.  
  - Owner updates settings and verifies changes.  
- Manual testing with a real club and tournament data.

---

### 📝 Implementation Hints

- **Reuse components**: The leaderboard table can be adapted from the global leaderboard component. Use the same styling for consistency.  
- **Date/time picker**: Use `react-day-picker` or a native input with `type="datetime-local"` for MVP.  
- **File upload**: Use a file input with `accept="image/*"`; the frontend should upload the file to a CDN and send the resulting URL to the backend. (A separate upload endpoint may be needed, but for MVP, we can use a generic file upload API.)  
- **Club Pro check**: Use `authStore.user?.club_pro_expires_at` to determine if the user has Club Pro. Only show the extra customisation fields if true.  
- **State management**: Use React Query’s `useQuery` and `useMutation` for all API calls. Use Zustand for UI state (e.g., active tab, dialog open).  
- **WebSocket**: The `useGameWebSocket` hook can be extended to listen for `club.updated` events. If not, create a separate `useClubWebSocket` hook that connects to a club‑specific channel (if the backend supports it). For now, polling every 5 minutes is acceptable as a fallback.

---

This issue provides a clear, self‑contained specification for the frontend club management UI, aligned with the existing codebase and design system.
