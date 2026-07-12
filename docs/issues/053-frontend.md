# 🎯 StackBluff Frontend Mega Plan: Fully Exploiting the Backend

After deep-diving your backend (21 crates: `sb-auth`, `sb-anti-cheat`, `sb-tournament`, `sb-club`, `sb-viral`, `sb-mission`, `sb-server` w/ R2 + season cards + GDPR + hand archive, `sb-game-engine` w/ Monte Carlo, `sb-table-registry` w/ kick votes + rebuys + multi-table, `sb-oracle`, `sb-notification`, `sb-bot-handler`, `sb-payment`) and your frontend (PWA with TanStack Router/Query, Zustand, Framer Motion, sonner, consent store, analytics, push), here is the gap analysis + mega plan.

---

## 📊 Gap Summary (Backend Has It / Frontend Doesn't Use It)

| # | Backend Feature | Frontend Status | Severity |
|---|---|---|---|
| 1 | Email verify / forgot / reset password / resend | ❌ No pages | 🔴 Critical |
| 2 | Telegram login (`/auth/telegram`) | ❌ No button | 🔴 Critical |
| 3 | Anti-cheat fingerprint (`/anti-cheat/fingerprint`) | ⚠️ Service exists, never called | 🔴 Critical |
| 4 | Transfer limit error (`TransferLimitExceeded(5000)`) | ❌ No friendly message | 🟡 High |
| 5 | Kick vote system (`StartKickVote`/`VoteKickYes`) | ❌ No UI | 🔴 Critical |
| 6 | Sit out/in (`InternalCommand::SitOut`) | ❌ No UI button | 🟡 High |
| 7 | Hand archive viewer (`GET /hands/{id}`) | ❌ No UI | 🟡 High |
| 8 | Replay cards (viral service) | ❌ No UI | 🟡 High |
| 9 | Season cards (PNG generator + R2) | ❌ No UI | 🟡 High |
| 10 | Rank tiers (Legend/Maestro/Diamond/...) | ❌ Not displayed | 🟡 High |
| 11 | GDPR account deletion | ❌ No UI | 🔴 Critical (legal) |
| 12 | Missions (`MissionServiceImpl`) | ❌ No UI | 🟡 High |
| 13 | Referral dashboard (founding_member) | ⚠️ Partial (badge only) | 🟡 High |
| 14 | Club creation/join/list | ❌ No UI | 🟡 High |
| 15 | Club pro upgrade (banner/chips/felt) | ❌ No UI | 🟡 High |
| 16 | Club tournament scheduling form | ⚠️ Hook only | 🟡 High |
| 17 | Club leaderboard (per-club) | ❌ Uses global hook | 🟡 High |
| 18 | Tournament blind schedule preview | ❌ No UI | 🟢 Medium |
| 19 | Tournament payout structure preview | ❌ No UI | 🟢 Medium |
| 20 | Tournament results history page | ❌ Modal only | 🟢 Medium |
| 21 | Player stats VPIP/PFR/showdowns | ⚠️ Partial | 🟢 Medium |
| 22 | Time bank display | ❌ Tracked, not shown | 🟢 Medium |
| 23 | ClubThemeUpdated WS message | ❌ Not handled | 🟢 Medium |
| 24 | PlayerRemoved WS message | ❌ Not shown | 🟢 Medium |
| 25 | Account settings (change pw/email) | ❌ No UI | 🟡 High |
| 26 | Avatar upload (`uploadFile.ts`) | ⚠️ Unused | 🟢 Medium |
| 27 | Stripe.js (`client_secret` returned) | ❌ Not wired | 🔴 Critical (revenue) |
| 28 | Telegram Stars invoice | ⚠️ Implemented | ✅ OK |
| 29 | `/profile` route exists but orphaned | ❌ Not in route tree | 🟡 High |
| 30 | `/clubs/$clubId` route exists but orphaned | ❌ Not in route tree | 🔴 Critical |
| 31 | Help/Guide page | ❌ "Hello" placeholder | 🟢 Medium |
| 32 | Multiple leaderboards (club/season) | ❌ Global only | 🟢 Medium |
| 33 | Hand history archive browser | ❌ Current table only | 🟢 Medium |
| 34 | Multi-table previews | ⚠️ Dots only | 🟢 Medium |
| 35 | Notification preferences per-type | ❌ All-or-nothing | 🟢 Medium |
| 36 | Telegram bot deep-linking | ⚠️ Partial | 🟢 Medium |

---

# 🚀 MEGA PLAN — 8 Phases

## **Phase 1: Authentication & Account Foundation** 🔴
*Unlock: email verification flow, password recovery, Telegram login, anti-cheat integration*

### 1.1 Create Forgot Password Page
**File:** `frontend/apps/pwa/src/routes/forgot-password.tsx`
- POST `/auth/forgot-password` with `{ email }`
- Show generic success: "If the email exists, a reset link has been sent"
- Reuse `GlassPanel` + `LiquidMetalButton` from login
- Add link from `/login` page
- Add to `routeTree.gen.ts` (run TanStack Router codegen)

### 1.2 Create Reset Password Page
**File:** `frontend/apps/pwa/src/routes/reset-password.tsx`
- Read `?token=...` from URL search params
- Form: `new_password` + `new_password_confirm`
- POST `/auth/reset-password` with `{ token, new_password }`
- On success → redirect to `/login` with toast
- Password strength meter (min 8 chars per backend rule)

### 1.3 Create Email Verification Landing Page
**File:** `frontend/apps/pwa/src/routes/verify-email.tsx`
- Read `?token=...` from URL
- GET `/auth/verify-email?token=...`
- Show success/failure state
- "Continue to lobby" CTA

### 1.4 Add Resend Verification Button
**File:** `frontend/apps/pwa/src/components/settings/AccountSettings.tsx` (new)
- POST `/auth/resend-verification` (needs auth token)
- Show only when `email_verified_at === null`
- Cooldown indicator (backend rate-limits 3/hour)

### 1.5 Add Telegram Login Button
**File:** Modify `frontend/apps/pwa/src/routes/login.tsx`
- Use `window.Telegram?.WebApp?.initData` 
- POST `/auth/telegram` with `{ init_data }`
- Detect Telegram environment via `useIsMiniApp()`
- Hide email form when in Telegram

### 1.6 Wire Up Anti-Cheat Fingerprint
**File:** Modify `frontend/apps/pwa/src/routes/__root.tsx` and `services/fingerprint.ts`
- Call `generateAndSubmitFingerprint(token)` after login
- Re-submit on each `/table/$tableId` mount (matches backend's per-session heads-up tracking)
- Send on reconnects

### 1.7 Account Lockout UX
**File:** Modify `frontend/apps/pwa/src/lib/errorHandler.ts`
- Detect 429 + "Account temporarily locked" → show countdown timer
- Disable login button for lockout duration (15 min)

### 1.8 Email Verification Banner
**File:** `frontend/apps/pwa/src/components/auth/EmailVerificationBanner.tsx` (new)
- Show on all pages when `email_verified_at === null` and platform === 'pwa'
- "Verify your email" CTA → `/verify-email?token=...` or resend
- Dismissible for current session

---

## **Phase 2: Tables, Kick Votes, Sit Out** 🔴
*Unlock: full table interaction parity*

### 2.1 Sit Out / Sit In Button
**File:** `frontend/apps/pwa/src/components/game/SitOutButton.tsx` (new)
- Send WS message `{ type: 'sit_out', room_id, sitting_out: true|false }`
- Hook into `useGameWebSocket.sendWsMessage`
- Show "AWAY" badge on hero seat when sitting out
- Add to `PlayerSpot` rendering: pulsing "AWAY" overlay
- Backend already broadcasts new TableState with `sitting_out: true`

### 2.2 Kick Vote Modal
**File:** `frontend/apps/pwa/src/components/game/KickVoteDialog.tsx` (new)
- Trigger: button on each opponent seat (long-press on mobile, hover menu on desktop)
- Only enabled when target `sitting_out === true` (backend rule)
- Send WS: `{ type: 'start_kick_vote', room_id, target_user_id }`
- Listen for `KickVoteStarted` → show modal with 10s countdown
- "Vote Yes" button → WS `VoteKickYes` with `kick_vote_id`
- Display yes_votes / required_votes
- Cooldown: 5 min per target (track in local state)

### 2.3 Handle `KickVoteUpdate` & `PlayerRemoved` WS Messages
**File:** Modify `frontend/apps/pwa/src/hooks/useGameWebSocket.ts`
- Add cases in `parseMessage`
- `KickVoteStarted` → toast + open dialog
- `KickVoteUpdate` → update progress bar
- `PlayerRemoved` → toast "Player X removed: Kicked by vote"
- `ClubThemeUpdated` → invalidate club query (for club tables)

### 2.4 Time Bank Display
**File:** Modify `frontend/apps/pwa/src/components/game/PlayerSpot.tsx`
- Backend already sends `time_bank_remaining_seconds` in PlayerStateInfo
- Show as small badge next to stack when < 10s remaining on turn
- Pulse animation when < 5s

### 2.5 Multi-Table Preview Thumbnails
**File:** Modify `TablePage.tsx` table rail
- Replace dots with mini seat layout (3x3 grid of player avatars)
- Hover → tooltip with table name, pot, your stack
- Click → switch active room (already wired)

### 2.6 Rebuy Auto-Prompt Improvements
**File:** Modify `TablePage.tsx`
- When `heroStack === 0` AND `handInProgress === false` → auto-open BuyInDialog with `isRebuy=true`
- Already partially done, ensure it doesn't fire during tournament (no rebuys)

---

## **Phase 3: Clubs — Full Feature Set** 🟡
*Unlock: club lifecycle, pro features, tournaments*

### 3.1 Fix Orphaned `/clubs/$clubId` Route
**File:** `frontend/apps/pwa/src/routes/clubs.$clubId.tsx`
- Already exists but not in `routeTree.gen.ts`
- Run TanStack Router codegen: `pnpm tsr generate`
- Verify the route loads

### 3.2 Clubs List Page
**File:** `frontend/apps/pwa/src/routes/clubs.tsx` (new)
- GET `/clubs` (need to verify backend exposes this — sb_club::handlers)
- Grid of club cards with logo, name, member count
- "Create Club" CTA

### 3.3 Create Club Modal
**File:** `frontend/apps/pwa/src/components/club/CreateClubModal.tsx` (new)
- POST `/clubs` with `{ name, telegram_group_id? }`
- On success → navigate to `/clubs/$clubId`

### 3.4 Join Club by Invite
**File:** `frontend/apps/pwa/src/routes/clubs/join.tsx` (new)
- Read `?invite=...` from URL
- POST `/clubs/join` with invite code
- Show club preview before joining

### 3.5 Club Settings Tab — Full Implementation
**File:** Modify `frontend/apps/pwa/src/components/club/ClubSettingsTab.tsx`
- Name editing
- Logo upload via `uploadFile.ts` (currently unused!)
- Telegram group ID linking
- **Pro features (gated by `hasActiveClubPro`)**:
  - Banner upload → R2 storage
  - Chip preset selection (dropdown)
  - Felt color picker (color input with hex validation matching `^#[0-9A-Fa-f]{6}$`)
- "Upgrade to Club Pro" CTA if not subscribed → `/shop`

### 3.6 Club Leaderboard Tab — Use Club-Specific Endpoint
**File:** Modify `frontend/apps/pwa/src/components/club/ClubLeaderboardTab.tsx`
- Currently uses global `useLeaderboard` hook
- Create `useClubLeaderboard(clubId)` hook
- GET `/clubs/${clubId}/leaderboard`
- Backend `LeaderboardRepo` likely supports club filter

### 3.7 Club Tournaments Tab — Full Scheduling Form
**File:** Modify `frontend/apps/pwa/src/components/club/ClubTournamentsTab.tsx`
- Use `useScheduleTournament` hook (already exists)
- Form fields:
  - Name
  - Max players (10-500, per backend `TournamentConfig`)
  - Buy-in (chips)
  - Scheduled start (datetime picker)
  - Blind schedule template (fetch from `/tournaments/blind-templates`)
  - Tournament type: SitAndGo vs MTT toggle
- Validation via Zod schema (extend `ScheduleTournamentRequestSchema`)
- Show only when `is_owner === true`

### 3.8 Blind Template Fetcher
**File:** `frontend/apps/pwa/src/hooks/useBlindTemplates.ts` (new)
- GET `/tournaments/blind-templates`
- Return `BlindTemplate[]` (schema exists in `lib/schemas.ts`)
- Used by scheduling form

### 3.9 Club Tournament Results Display
**File:** Modify `ClubTournamentsTab.tsx`
- Show completed tournaments with results
- GET `/tournaments/${id}/results`
- Display podium (🥇🥈🥉) with prize amounts
- "Post to Telegram" button if owner

### 3.10 Handle `ClubThemeUpdated` WS Message
**File:** Modify `useGameWebSocket.ts`
- Invalidate `['club', clubId]` query
- Update table felt color live (read from club data)
- Update chip preset live

---

## **Phase 4: Tournaments — Polish & Admin** 🟡
*Unlock: full tournament experience, admin tools*

### 4.1 Tournament Detail Page
**File:** `frontend/apps/pwa/src/routes/tournaments/$tournamentId.tsx` (new)
- Full tournament info: blind schedule, payout structure, registrations
- Live leaderboard during tournament
- Results table after completion
- Spectator view link

### 4.2 Blind Schedule Preview Component
**File:** `frontend/apps/pwa/src/components/tournament/BlindSchedulePreview.tsx` (new)
- Display levels as table: Level | SB | BB | Ante | Duration
- Highlight current level (from `TournamentBlindLevel` WS event)
- Show next level in 30s countdown

### 4.3 Payout Structure Preview
**File:** `frontend/apps/pwa/src/components/tournament/PayoutStructurePreview.tsx` (new)
- Display positions and percentages
- Show calculated prize amounts based on current registrations
- Update live as registrations change

### 4.4 Tournament Filters
**File:** Modify `frontend/apps/pwa/src/routes/tournaments.tsx`
- Filter tabs: All | SitAndGo | MTT
- Status filter: Registering | Running | Completed
- Use `useTournamentsQuery({ type, status })` (already supports it)

### 4.5 Tournament Results History Page
**File:** `frontend/apps/pwa/src/routes/tournaments/history.tsx` (new)
- GET `/tournaments?status=completed`
- List of past tournaments user participated in
- Click → detail page with full results

### 4.6 Admin Tournament Creation (if user is admin)
**File:** `frontend/apps/pwa/src/components/tournament/AdminCreateTournament.tsx` (new)
- Same form as club scheduling but for global tournaments
- POST `/tournaments` (verify backend route)
- Only show for admin users (need admin flag in user profile)

### 4.7 Tournament Reminder Settings
**File:** `frontend/apps/pwa/src/components/settings/NotificationPreferences.tsx` (new)
- Toggle: "Tournament reminders (60min, 10min before)"
- Toggle: "Tournament results"
- Toggle: "Club tournament announcements"
- Store in user preferences (need backend endpoint or localStorage)

---

## **Phase 5: Player Profile, Stats, Missions, Viral** 🟡
*Unlock: engagement & retention features*

### 5.1 Fix Orphaned `/profile` Route
**File:** `frontend/apps/pwa/src/routes/profile.tsx`
- Run TanStack Router codegen
- Build full profile page

### 5.2 Full Profile Page
**File:** Rewrite `ProfilePage.tsx`
- Header: avatar, display name, rank tier badge, founding member crown
- Stats summary cards: hands played, net profit, biggest pot, win rate
- VPIP/PFR/Aggression factor display
- Season rank card (from R2)
- Badges section (already exists `BadgeSection`)
- Achievement timeline
- Edit profile button → settings

### 5.3 Public Profile Page
**File:** `frontend/apps/pwa/src/routes/players/$userId.tsx` (new)
- GET `/players/${userId}/stats`
- GET `/users/${userId}/badges`
- Limited view (no sensitive data)
- "Challenge to heads-up" CTA (future)

### 5.4 Enhanced PlayerStatsDialog
**File:** Modify `frontend/apps/pwa/src/components/game/PlayerStatsDialog.tsx`
- Display ALL backend stats:
  - VPIP %, PFR %, Aggression
  - Showdowns, showdown win %
  - Hands won without showdown
  - Total wagered, biggest pot
  - All-in count
  - Preflop fold %
- Add visual: radial charts, sparklines
- Compare to "average player" baseline

### 5.5 Missions Page
**File:** `frontend/apps/pwa/src/routes/missions.tsx` (new)
- GET `/missions` (need to verify backend route in `sb-mission`)
- Display active missions with progress bars
- Mission types (from `HandResult` flags):
  - "Raise preflop X times" → tracks `raised_preflop`
  - "Go to showdown X times" → tracks `went_to_showdown`
  - "Go all-in X times" → tracks `went_allin`
- Claim reward button when complete
- Daily/weekly mission rotation

### 5.6 Referral Dashboard
**File:** `frontend/apps/pwa/src/routes/referrals.tsx` (new)
- GET `/referrals` (verify backend route in `sb-viral`)
- Display:
  - Referral link with copy button + share buttons (Twitter, Telegram, WhatsApp)
  - Referred friends list with their hand counts
  - Progress to founding_member (10 referrals with 5+ hands)
  - Total bonus chips earned
- `FoundingMemberProgress` component already exists

### 5.7 Replay Cards Gallery
**File:** `frontend/apps/pwa/src/routes/replays.tsx` (new)
- GET `/replays` (verify backend route in `sb-viral` `ReplayCardObserver`)
- List of significant hands (showdowns, all-ins)
- Each card: hand description, pot, winner, date
- Click → hand replay viewer (Phase 6)

### 5.8 Avatar Upload
**File:** `frontend/apps/pwa/src/components/settings/AvatarUpload.tsx` (new)
- Use existing `uploadFile.ts`
- POST `/api/upload` with FormData
- Crop/resize client-side before upload
- Update user profile

---

## **Phase 6: Hand History & Archive** 🟡
*Unlock: full hand history browsing, replays*

### 6.1 Hand History Browser Page
**File:** `frontend/apps/pwa/src/routes/history.tsx` (new)
- GET `/hands?user_id=me&limit=50&offset=0`
- Filters: date range, stake level, table, winning/losing hands
- Table view: date, table, pot, result, hand description
- Click row → hand detail view

### 6.2 Hand Detail / Replay Viewer
**File:** `frontend/apps/pwa/src/components/history/HandReplay.tsx` (new)
- Fetch hand by ID: GET `/hands/{id}` (backend supports archived hands from R2!)
- Step-through replay: preflop → flop → turn → river → showdown
- Animate cards dealing (reuse `DealAnimationLayer` logic)
- Show each player's action with timestamps
- Highlight winning cards
- "Share replay" button → generates shareable link

### 6.3 Live Hand History in Table
**File:** Modify `frontend/apps/pwa/src/components/game/HistoryDialog.tsx`
- Currently shows current table only
- Enhance: show last 20 hands with mini-replay
- Filter: only show hands I won/lost

### 6.4 Hand Statistics Aggregation
**File:** `frontend/apps/pwa/src/components/history/HandStats.tsx` (new)
- Aggregate hand history: win rate by position, by stake, by hour
- Charts using Recharts or similar
- Identify leaks (e.g., "You fold too much from UTG")

---

## **Phase 7: Season Cards, Ranks, GDPR, Shop** 🟡
*Unlock: monetization, compliance, progression*

### 7.1 Season Card Display
**File:** `frontend/apps/pwa/src/components/profile/SeasonCardDisplay.tsx` (new)
- GET `/seasons/current/rank` → current rank tier
- GET `/season-cards` → user's past season cards
- Display current rank with progress to next tier
- Gallery of past season cards (PNG images from R2)
- Share button for season cards

### 7.2 Rank Tier Badge Everywhere
**File:** `frontend/apps/pwa/src/components/game/RankTierBadge.tsx` (new)
- Display rank tier icon next to player names
- Tiers: Brick 🧱, Bronze 🥉, Silver 🥈, Gold 🥇, Platinum 💿, Diamond 💎, Maestro 🎭, Legend 👑
- Show in: PlayerSpot, leaderboard, profile, tournament results

### 7.3 Season End Notification
**File:** `frontend/apps/pwa/src/components/season/SeasonEndBanner.tsx` (new)
- When season ends (check via `/seasons/current`), show banner
- "Season X ended! You finished as Gold. View your season card →"
- Auto-dismiss after viewing

### 7.4 GDPR Account Deletion
**File:** `frontend/apps/pwa/src/routes/settings/data.tsx` (new)
- "Delete my account" section
- Two-step confirmation
- POST `/gdpr/request-deletion`
- Show: "Your account will be permanently deleted in 30 days. You can cancel before then."
- "Cancel deletion" button if pending

### 7.5 Data Export Request
**File:** Same page as 7.4
- "Download my data" button
- POST `/gdpr/export`
- Show: "We'll email you a download link within 72 hours"

### 7.6 Stripe.js Integration (CRITICAL for revenue)
**File:** `frontend/apps/pwa/src/lib/stripe.ts` (new)
- Install `@stripe/stripe-js`
- Load Stripe.js with publishable key from env
- `confirmCardPayment(clientSecret)` flow
**File:** Modify `usePurchaseFlow.ts`
- When `intent.client_secret` exists → render Stripe Elements card input
- Confirm payment → poll `user-me` for balance update
- Handle 3DS authentication

### 7.7 Purchase History
**File:** `frontend/apps/pwa/src/routes/settings/purchases.tsx` (new)
- GET `/payments/history`
- Table: date, product, amount, status
- Download invoice (PDF link)

### 7.8 Shop Product Categories
**File:** Modify `ShopPage.tsx`
- Tabs: Chips | Season Pass | Club Pro
- Season Pass card: shows 8 weeks unlimited Oracle
- Club Pro card: shows club customization features
- Featured/recommended badges

---

## **Phase 8: Polish, Help, Misc** 🟢
*Unlock: completeness, accessibility, UX polish*

### 8.1 Real Guide Page
**File:** Rewrite `frontend/apps/pwa/src/routes/guide.tsx`
- Poker hand rankings (use `HandRank` enum from backend)
- Texas Hold'em rules
- Table etiquette
- Tournament vs Cash game differences
- Interactive: "What's the best hand?" quiz

### 8.2 Settings Sub-Pages
**File:** `frontend/apps/pwa/src/routes/settings/` (new directory)
- `account.tsx` — change password, change email, delete account
- `notifications.tsx` — move NotificationsSettings here, add tournament preferences
- `appearance.tsx` — theme (dark only for now), table felt color preference
- `audio.tsx` — sound effects volume, haptics
- `privacy.tsx` — GDPR, data export, analytics opt-out
- `payments.tsx` — purchase history, payment methods

### 8.3 Toast System Improvements
**File:** Modify `frontend/apps/pwa/src/lib/errorHandler.ts`
- Map specific backend errors to user-friendly messages:
  - `TransferLimitExceeded(5000)` → "You've reached the daily chip transfer limit (5,000). Try again tomorrow."
  - `RateLimited` → "Slow down! You're acting too fast."
  - `TournamentFull` → "This tournament is full."
  - `TournamentRegistrationClosed` → "Registration is closed for this tournament."
  - `TournamentAlreadyStarted` → "This tournament has already started."
  - `InvalidSeat` → "That seat is taken or invalid."

### 8.4 PWA Install Prompt
**File:** `frontend/apps/pwa/src/components/pwa/InstallPrompt.tsx` (new)
- Listen for `beforeinstallprompt` event
- Show custom install banner
- Track install via analytics

### 8.5 Offline Indicator
**File:** `frontend/apps/pwa/src/components/pwa/OfflineIndicator.tsx` (new)
- Listen for `navigator.onLine` changes
- Show banner when offline
- Queue actions for retry

### 8.6 Help / Support Page
**File:** `frontend/apps/pwa/src/routes/help.tsx` (new)
- FAQ accordion
- Contact form (POST to support endpoint)
- Telegram support group link
- Bug report form

### 8.7 Terms of Service & Privacy Policy
**File:** `frontend/apps/pwa/src/routes/legal/terms.tsx` + `privacy.tsx`
- Static content
- Required for app store submissions

### 8.8 Responsible Gaming Page
**File:** `frontend/apps/pwa/src/routes/responsible-gaming.tsx` (new)
- Self-exclusion options
- Deposit limits
- Reality checks ("You've been playing for 2 hours")
- Links to gambling addiction resources

### 8.9 Leaderboard Enhancements
**File:** Modify `leaderboard.tsx`
- Tabs: Global | Weekly | Monthly
- Top 3 podium with avatars
- "Your rank" sticky bar at bottom
- Click player → public profile

### 8.10 Notification Preferences (Granular)
**File:** `frontend/apps/pwa/src/components/settings/NotificationPreferences.tsx`
- Per-event toggles:
  - Tournament reminders
  - Tournament results
  - Club announcements
  - Friend activity
  - Promotional
- Stored server-side via PATCH `/notifications/preferences`

### 8.11 Telegram Bot Linking
**File:** `frontend/apps/pwa/src/routes/settings/telegram.tsx` (new)
- If user is PWA (email) user, offer to link Telegram
- Deep link to bot: `https://t.me/StackBluffBot?start=link_{userId}`
- Show linked status

### 8.12 Sound Design System
**File:** `frontend/apps/pwa/src/lib/sounds.ts` (new)
- Use Web Audio API
- Sounds for: card deal, chip bet, check, fold, all-in, win, lose, timer warning, tournament start, blind level up
- Volume control in settings
- Already have `useFeedback` hook for haptics, integrate sounds

---

## 📋 Implementation Priority Order

### Sprint 1 (Week 1-2): Critical Auth & Revenue
1. Phase 1.1-1.3: Forgot/Reset/Verify password pages
2. Phase 1.5: Telegram login
3. Phase 1.6: Anti-cheat fingerprint wiring
4. Phase 7.6: Stripe.js integration
5. Phase 1.4, 1.8: Resend verification + banner

### Sprint 2 (Week 3-4): Table Parity
6. Phase 2.1: Sit out/in
7. Phase 2.2-2.3: Kick vote system
8. Phase 2.4: Time bank display
9. Phase 3.1: Fix club route
10. Phase 8.3: Error message mapping

### Sprint 3 (Week 5-6): Clubs Full
11. Phase 3.2-3.4: Club list/create/join
12. Phase 3.5: Club settings with pro features
13. Phase 3.6-3.7: Club leaderboard + tournament scheduling
14. Phase 3.10: ClubThemeUpdated handling

### Sprint 4 (Week 7-8): Tournaments & Profile
15. Phase 4.1-4.3: Tournament detail + blind/payout preview
16. Phase 4.4: Tournament filters
17. Phase 5.1-5.2: Fix profile route + full page
18. Phase 5.4: Enhanced stats dialog
19. Phase 5.5: Missions page

### Sprint 5 (Week 9-10): History & Seasons
20. Phase 6.1-6.2: Hand history browser + replay
21. Phase 7.1-7.2: Season cards + rank badges
22. Phase 5.6-5.7: Referral dashboard + replays
23. Phase 7.4-7.5: GDPR compliance

### Sprint 6 (Week 11-12): Polish
24. Phase 8.1-8.2: Guide + settings sub-pages
25. Phase 8.4-8.8: PWA + offline + help + legal
26. Phase 8.9-8.12: Leaderboard + notifications + Telegram linking + sounds

---

## 🔧 Required New Files (Summary)

```
frontend/apps/pwa/src/
├── routes/
│   ├── forgot-password.tsx
│   ├── reset-password.tsx
│   ├── verify-email.tsx
│   ├── clubs.tsx
│   ├── clubs/join.tsx
│   ├── tournaments/$tournamentId.tsx
│   ├── tournaments/history.tsx
│   ├── missions.tsx
│   ├── referrals.tsx
│   ├── replays.tsx
│   ├── history.tsx
│   ├── players/$userId.tsx
│   ├── settings/
│   │   ├── account.tsx
│   │   ├── notifications.tsx
│   │   ├── appearance.tsx
│   │   ├── audio.tsx
│   │   ├── privacy.tsx
│   │   ├── payments.tsx
│   │   ├── telegram.tsx
│   │   └── data.tsx
│   ├── help.tsx
│   ├── responsible-gaming.tsx
│   └── legal/{terms,privacy}.tsx
├── components/
│   ├── auth/EmailVerificationBanner.tsx
│   ├── game/{SitOutButton,KickVoteDialog,RankTierBadge}.tsx
│   ├── tournament/{BlindSchedulePreview,PayoutStructurePreview,AdminCreateTournament}.tsx
│   ├── club/{CreateClubModal}.tsx
│   ├── history/{HandReplay,HandStats}.tsx
│   ├── profile/SeasonCardDisplay.tsx
│   ├── settings/{AccountSettings,NotificationPreferences,AvatarUpload}.tsx
│   ├── season/SeasonEndBanner.tsx
│   ├── pwa/{InstallPrompt,OfflineIndicator}.tsx
│   └── tournament/TournamentCard.tsx (enhance)
├── hooks/
│   ├── useClubLeaderboard.ts
│   ├── useBlindTemplates.ts
│   ├── useMissions.ts
│   ├── useReferrals.ts
│   ├── useHandHistory.ts
│   ├── useSeasonCards.ts
│   └── useGDPR.ts
└── lib/
    ├── stripe.ts
    └── sounds.ts
```

---

## ⚠️ Backend Verification Needed

Before implementing, verify these endpoints exist (couldn't see all REST routes in dump):
- `GET /clubs` — list user's clubs
- `POST /clubs` — create club
- `POST /clubs/join` — join by invite
- `GET /clubs/{id}/leaderboard` — club leaderboard
- `GET /missions` — mission list
- `GET /referrals` — referral dashboard
- `GET /replays` — replay cards
- `GET /hands` (list) — hand history list
- `GET /seasons/current` — current season info
- `GET /season-cards` — user's season cards
- `POST /gdpr/request-deletion`
- `POST /gdpr/export`
- `GET /payments/history`
- `PATCH /notifications/preferences`
- `GET /tournaments/blind-templates`

If any are missing, add them to `sb-rest-router` first.

---

This mega plan covers **every** backend capability I found in your dump. Each phase delivers user-facing value incrementally. Start with **Sprint 1** — auth + Stripe are the highest-impact items for user acquisition and revenue. Want me to deep-dive any specific phase and produce actual code?
