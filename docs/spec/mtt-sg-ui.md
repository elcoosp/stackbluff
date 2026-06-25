# Production-Ready Tournament UX Specification v8.0  
*Fully aligned with StackBluff backend codebase – all review feedback incorporated.*

---

## 1. Overview

This specification defines the frontend implementation for **Sit‑and‑Go (S&G)** and **Multi‑Table Tournaments (MTT)**. The backend is fully implemented with:
- `sb-tournament` crate: `SitGoTournament` and `MttDirector` actors with blind scheduling, rebalancing, payout calculation, and crash recovery.
- Database tables: `tournaments`, `tournament_registrations`, `tournament_results`.
- WebSocket events: `TournamentState`, `TournamentRegistered`, `TournamentStarting`, `TournamentBlindLevel`, `TournamentElimination`, `TournamentTableChanged`, `TournamentResult`.
- REST endpoints: `/tournaments` (list, create, get, register, unregister, results).

The frontend extends the existing cash‑game UI with tournament discovery, registration, in‑game HUD, multi‑table management, spectator mode, and results.

---

## 2. Architecture Alignment

### 2.1. Backend Contracts (Already Implemented)

**REST Endpoints** (from `sb-rest-router/src/tournament_routes.rs`):
- `GET /tournaments` – list tournaments with optional type filter.
- `GET /tournaments/:id` – get tournament summary (includes payout structure).
- `POST /tournaments` – create tournament (admin only).
- `POST /tournaments/:id/register` – register current user.
- `POST /tournaments/:id/unregister` – unregister.
- `GET /tournaments/:id/results` – get results.

**Error Responses** (mapped from `AppError` variants):
- `TournamentFull` – tournament is at capacity.
- `TournamentRegistrationClosed` – registration period ended or tournament already started.
- `InsufficientFunds` – user does not have enough chips.
- `Conflict` (already registered) – user is already registered.
- `NotFound` – tournament does not exist.

**WebSocket Events** (from `sb-table-registry/src/game_room.rs`):
- `TournamentState` – global state updates: blind level, players remaining, prize pool, tables map.
- `TournamentRegistered` – registration confirmation.
- `TournamentStarting` – countdown start (S&G).
- `TournamentBlindLevel` – blind level progression.
- `TournamentElimination` – player eliminated with position.
- `TournamentTableChanged` – player moved to new table/seat.
- `TournamentResult` – tournament complete with winners and payouts.

**WebSocket Commands** (from `sb-ws-handler/src/lib.rs`):
- `register_tournament` – subscribe to tournament global room.
- `unregister_tournament` – unsubscribe.
- `spectate_tournament` – spectator subscription.

### 2.2. Final Table Detection

The backend does **not** emit a dedicated `TournamentFinalTable` event. Instead, the frontend derives final table state from the `TournamentState` event when `players_remaining <= 9`. This triggers the "FINAL TABLE" banner in the UI.

### 2.3. Payout Display

Payouts are available in two places:
1. **Tournament configuration** – `PayoutStructure` contains percentage-based payouts; fetched via `GET /tournaments/:id` as part of the `TournamentSummary`.
2. **TournamentResult event** – contains actual payouts for each player after completion.

For in‑game HUD tooltip, the frontend fetches the tournament summary (which includes the payout structure) and displays the percentages. For the results screen, the `TournamentResult` event provides the actual prize amounts.

### 2.4. Frontend Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      UI Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐ │
│  │ Tournament  │  │ Tournament  │  │ Tournament     │ │
│  │ Lobby       │  │ HUD         │  │ Results        │ │
│  └─────────────┘  └─────────────┘  └────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐ │
│  │ Table       │  │ TableChange │  │ BlindLevel     │ │
│  │ Overview    │  │ Alert       │  │ Notification   │ │
│  └─────────────┘  └─────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                  Presentation Layer                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │       useTournament (custom hook)                │  │
│  │  - subscribes to tournament global room          │  │
│  │  - manages tournament store actions              │  │
│  │  - provides reactive state to components         │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                    State Layer (Zustand)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ tournament  │  │ gameStore   │  │ authStore       │ │
│  │ Store (new) │  │(unchanged)  │  │ (unchanged)     │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                Infrastructure Layer                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  useGameWebSocket (extended with tournament     │  │
│  │  event handlers and logging)                    │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  API client (extended)                          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Detailed User Flows

### 3.1. Tournament Discovery & Registration

**Lobby Page** – add a “Tournaments” tab alongside “Cash Games”.

**Data Fetching:**
```typescript
// useTournamentsQuery.ts
const { data } = useQuery({
  queryKey: ['tournaments', statusFilter, typeFilter],
  queryFn: () => apiClient<{ tournaments: TournamentSummary[] }>('/tournaments'),
  refetchInterval: 10_000, // refresh every 10s for live counts
});
```

**TournamentCard Components:**
- Displays: name, type (S&G/MTT), buy‑in, current/max players, prize pool, blind structure summary (e.g., “15 min levels”), status (Registering / Running / Completed).
- Countdown timer if `status === 'Registering'` and `startsAt` is set.
- Action button:
  - `Registering`: “Register” (if not registered) / “Registered” (disabled) / “Unregister”.
  - `Running`: “Spectate” (if not registered) / “Play” (if registered – navigates to table).
  - `Completed`: “Results”.

**Registration Flow:**
1. Click “Register” → `TournamentBuyInDialog` opens (fixed buy‑in, shows balance).
2. Confirm → optimistic UI update (disable button, increment player count).
3. Call `POST /tournaments/:id/register` with `{ user_id }`.
4. Backend deducts buy‑in, inserts registration, increments prize pool.
5. WS event `TournamentRegistered` arrives → update store → card reflects new count.
6. If tournament fills to `max_players`, backend auto‑starts S&G after `start_delay_seconds`.

**Error Handling (exact backend errors):**
| Backend Error | User‑Friendly Toast |
|---------------|---------------------|
| `TournamentFull` | “This tournament is full.” |
| `TournamentRegistrationClosed` | “Registration is closed.” |
| `InsufficientFunds` | “You don’t have enough balance.” |
| `Conflict` (already registered) | “You are already registered.” |
| `NotFound` | “Tournament not found.” |

**Unregister:**
1. Click “Unregister” → `POST /tournaments/:id/unregister` with `{ user_id }`.
2. Refund buy‑in, decrement prize pool.

### 3.2. Pre‑Start Countdown (S&G)

- WS event `TournamentStarting` includes `starts_in_seconds`.
- Show full‑screen countdown overlay (reuse `TimerBar` with total duration).
- After countdown ends → navigate to `/table/:tableId?tournamentId=:id`.
- `useTournament` subscribes to tournament global room on mount.

### 3.3. Tournament Table (In‑Game)

**TablePage** conditionally renders:
- `TournamentHUD` (if `tournamentId` in URL).
- `TableOverviewPanel` (if MTT).
- `FinalTableBanner` (derived from `playersRemaining <= 9` in `TournamentState`).

**TournamentHUD** (collapsible):
- Blind level + blinds.
- Time to next level (`TimerBar` with `remainingMs` / `totalMs` – derived from `next_blind_at`).
- Players remaining / total.
- Average stack = total chips / playersRemaining (computed via selector).
- Your stack (from `gameStore`).
- Prize pool.
- Payout tooltip (click to expand – fetches payout structure from the tournament summary and displays percentages/estimates).

**Blind Level Change Notification:**
- WS event `TournamentBlindLevel` → slide‑in banner (“Blinds increased to Level X: sb/bb”) auto‑dismiss after 3s.

**Elimination Toast:**
- WS event `TournamentElimination` → `toast` with player name and position.

### 3.4. Multi‑Table Tournament (MTT)

**Table Overview Panel** (sidebar / bottom sheet):
- Lists all tables from `tournamentStore.tables` map (tableId → playerCount).
- Each entry: table number, player count, indicator if current table.
- Click to switch active table (for spectators).

**Table Change Flow:**
1. WS event `TournamentTableChanged` (new room id, seat).
2. Show forced‑acknowledgement modal (`TableChangeAlert`).
3. Update `tournamentStore.myTableId` and `gameStore` active room.
4. If viewing old table → navigate to new table.

**Final Table:**
- Derived from `playersRemaining <= 9` in `TournamentState` → persistent banner “FINAL TABLE”.

**Table Merge Animation:** Brief overlay “Rebalancing…” during rebalance (optional, backend emits `TournamentTableChanged` for each move).

### 3.5. Spectator Mode

- Same as cash: `?observe=true`.
- `useTournament` subscribes to tournament global room.
- Spectator can click tables in `TableOverviewPanel` to switch active view.
- Spectator sees all cards face‑down; action bar is hidden.

### 3.6. Tournament Completion

- WS event `TournamentResult` with `results` array (user_id, position, prize).
- Show `TournamentResultsModal` (full‑screen):
  - Position list with prizes.
  - Highlight own position.
  - Winner celebration (trophy animation – reuse `WinnerOverlay` from `PlayerSpot`).
  - Button “Return to Lobby”.
- Update `authStore.balance` with winnings (if any).

---

## 4. UI Component Specifications

All components use existing patterns: glass‑morphism (`backdrop‑blur`, `border-white/10`), `motion` animations, responsive with `useResponsiveLayout`.

### 4.1. `TournamentCard`
- Props: `tournament: TournamentSummary`, `onRegister`, `onUnregister`, `isRegistering`, `isUnregistering`.
- Status badge: Registering (green pulse), Running (blue), Completed (gray).
- If Registering: show countdown timer (from `startsAt`).
- Action button: “Register” / “Registered (disabled)” / “Unregister”.

### 4.2. `TournamentBuyInDialog`
- Props: `open`, `tournamentId`, `buyIn`, `currentBalance`, `onClose`, `onConfirm`, `isProcessing`.
- Fixed buy‑in amount (non‑editable). Simple confirmation.

### 4.3. `TournamentHUD`
- Props: `tournament: TournamentState`, `myStack: number`, `isMobile: boolean`.
- Collapsible state managed internally.
- Sub‑components:
  - `BlindLevelDisplay` – shows “Level 3: 50/100”.
  - `NextLevelTimer` – uses `TimerBar` with `remainingMs`/`totalMs`.
  - `PlayersRemainingDisplay` – “12 / 30”.
  - `AverageStackDisplay` – computed in store.
  - `PrizePoolDisplay` – with `PayoutTooltip` (expandable, fetches payout structure from tournament summary).

### 4.4. `TableOverviewPanel`
- Props: `tables: Record<string, number>`, `activeTableId: string | null`, `onSelectTable`, `isSpectator`, `isMobile`.
- Uses `useVirtual` if table count > 20.

### 4.5. `TournamentResultsModal`
- Props: `open`, `results: Array<{ user_id, position, prize }>`, `myUserId`, `onClose`.
- Scrollable list with `motion` stagger.
- Winner celebration: trophy SVG with sparkles.

### 4.6. `BlindLevelNotification`
- Props: `level`, `blinds`, `visible`, `onAutoHide`.
- Slides in from top, auto‑dismiss after 3s.

### 4.7. `TableChangeAlert`
- Props: `open`, `newRoomId`, `newSeat`, `onAcknowledge`.
- Full‑screen modal with forced acknowledgment.

### 4.8. `TournamentCountdownOverlay`
- Props: `startsInSeconds`, `onComplete`.
- Full‑screen overlay with large countdown number, label “Tournament starts in…”, and `TimerBar`.

### 4.9. `FinalTableBanner`
- Props: `visible: boolean`.
- Persistent banner at top of table view: “FINAL TABLE” with animated glow.

---

## 5. State Management

### 5.1. `tournamentStore` (Zustand)

**Type Definitions:**
```typescript
// tournament.types.ts
export interface TournamentSummary {
  id: string;
  tournamentType: 'SitAndGo' | 'Mtt';
  status: 'Registering' | 'Running' | 'Completed' | 'Cancelled';
  registered: number;
  maxPlayers: number;
  buyIn: number;
  prizePool: number;
  currentBlindLevel?: number;
  startedAt?: Date;
  payoutStructure?: PayoutEntry[]; // percentage-based
}

export interface TournamentState {
  tournamentId: string;
  status: string;
  registeredCount: number;
  maxPlayers: number;
  prizePool: number;
  blindLevel?: number;
  playersRemaining?: number;
  tables?: Record<string, number>; // tableId → playerCount
  myTableId?: string;
}

export interface TournamentResult {
  tournamentId: string;
  user_id: string;
  position: number;
  prize: number;
}

export interface PayoutEntry {
  position: number;
  percentage: number;
}
```

**Store Interface:**
```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface TournamentStore {
  tournaments: Record<string, TournamentSummary>;
  activeTournamentId: string | null;
  tournamentStates: Record<string, TournamentState>;
  results: Record<string, TournamentResult[]>;
  
  // actions
  setTournament: (id: string, data: Partial<TournamentSummary>) => void;
  setTournamentState: (id: string, data: Partial<TournamentState>) => void;
  setActiveTournament: (id: string | null) => void;
  setResults: (id: string, results: TournamentResult[]) => void;
  clearTournament: (id: string) => void;
}

export const useTournamentStore = create<TournamentStore>()(
  devtools(
    (set) => ({
      tournaments: {},
      activeTournamentId: null,
      tournamentStates: {},
      results: {},
      setTournament: (id, data) =>
        set((state) => ({
          tournaments: {
            ...state.tournaments,
            [id]: { ...state.tournaments[id], ...data },
          },
        })),
      setTournamentState: (id, data) =>
        set((state) => ({
          tournamentStates: {
            ...state.tournamentStates,
            [id]: { ...state.tournamentStates[id], ...data },
          },
        })),
      setActiveTournament: (id) => set({ activeTournamentId: id }),
      setResults: (id, results) =>
        set((state) => ({
          results: { ...state.results, [id]: results },
        })),
      clearTournament: (id) => {
        const { [id]: _, ...rest } = state.tournaments;
        return { tournaments: rest };
      },
    }),
    { name: 'tournamentStore' }
  )
);
```

### 5.2. `useTournament` Hook
```typescript
export function useTournament(tournamentId: string) {
  const tournament = useTournamentStore((s) => s.tournaments[tournamentId]);
  const state = useTournamentStore((s) => s.tournamentStates[tournamentId]);
  const setState = useTournamentStore((s) => s.setTournamentState);
  const setActive = useTournamentStore((s) => s.setActiveTournament);
  
  const { sendWsMessage } = useGameWebSocket();
  
  // Subscribe to tournament room on mount
  useEffect(() => {
    if (tournamentId && tournament?.status === 'Running') {
      sendWsMessage('register_tournament', { tournament_id: tournamentId });
      return () => {
        sendWsMessage('unregister_tournament', { tournament_id: tournamentId });
      };
    }
  }, [tournamentId, tournament?.status]);
  
  return { tournament, state, setState, setActive };
}
```

### 5.3. WebSocket Event Handlers (in `useGameWebSocket`)
```typescript
// Add to parseMessage
case 'TournamentState':
  useTournamentStore.getState().setTournamentState(data.tournament_id, {
    status: data.status,
    registeredCount: data.registered_count,
    maxPlayers: data.max_players,
    prizePool: data.prize_pool,
    blindLevel: data.blind_level,
    playersRemaining: data.players_remaining,
    tables: data.tables,
  });
  // If playersRemaining <= 9, show final table banner
  break;

case 'TournamentRegistered':
  useTournamentStore.getState().setTournament(data.tournament_id, {
    registered: data.current_players,
  });
  break;

case 'TournamentStarting':
  // Show countdown overlay
  // After countdown → navigate to table
  break;

case 'TournamentBlindLevel':
  useTournamentStore.getState().setTournamentState(data.tournament_id, {
    blindLevel: data.level,
  });
  // Show notification
  break;

case 'TournamentElimination':
  // Show toast
  break;

case 'TournamentTableChanged':
  useTournamentStore.getState().setTournamentState(data.tournament_id, {
    myTableId: data.new_room_id,
  });
  // Show alert, navigate if needed
  break;

case 'TournamentResult':
  useTournamentStore.getState().setResults(data.tournament_id, data.results);
  // Show results modal
  break;
```

---

## 6. REST API Integration

### 6.1. Endpoints (Already Implemented)

| Method | Endpoint | Frontend Use |
|--------|----------|--------------|
| `GET` | `/tournaments` | List tournaments with filters |
| `GET` | `/tournaments/:id` | Get tournament summary (includes payout structure) |
| `POST` | `/tournaments/:id/register` | Register player (body: `{ user_id }`) |
| `POST` | `/tournaments/:id/unregister` | Unregister player (body: `{ user_id }`) |
| `GET` | `/tournaments/:id/results` | Get results |

### 6.2. API Client Integration
```typescript
// api/tournaments.ts
export const tournamentApi = {
  list: (params?: { type?: string }) =>
    apiClient<{ tournaments: TournamentSummary[] }>('/tournaments', { params }),
  
  get: (id: string) =>
    apiClient<TournamentSummary>(`/tournaments/${id}`),
  
  register: (tournamentId: string, userId: string) =>
    apiClient<{ status: string }>(`/tournaments/${tournamentId}/register`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  
  unregister: (tournamentId: string, userId: string) =>
    apiClient<{ status: string }>(`/tournaments/${tournamentId}/unregister`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  
  results: (tournamentId: string) =>
    apiClient<TournamentResult[]>(`/tournaments/${tournamentId}/results`),
};
```

### 6.3. Error Handling (mapped from backend responses)
```typescript
// In the register/unregister functions, catch errors and map:
try {
  await tournamentApi.register(id, userId);
} catch (error) {
  const message = error.message || '';
  if (message.includes('TournamentFull')) {
    toast.error('This tournament is full.');
  } else if (message.includes('TournamentRegistrationClosed')) {
    toast.error('Registration is closed.');
  } else if (message.includes('InsufficientFunds')) {
    toast.error('You don\'t have enough balance.');
  } else if (message.includes('Conflict')) {
    toast.error('You are already registered.');
  } else if (message.includes('NotFound')) {
    toast.error('Tournament not found.');
  } else {
    toast.error('Registration failed. Please try again.');
  }
}
```

---

## 7. Performance Optimisations

- **Selective store subscriptions** – use selectors to avoid re‑renders.
- **Memoisation** – all HUD sub‑components `React.memo`.
- **Timer updates** – use `setInterval` every 200ms, update only `TimerBar`.
- **Virtualisation** – `TableOverviewPanel` uses `react‑virtual` if tables > 20.
- **Debounced actions** – registration/unregistration buttons debounced (300ms).
- **Payout caching** – fetch tournament summary once and cache; payout structure is static.

---

## 8. Debuggability & Observability

- **Structured logging:** Use `console.debug` with a feature flag for development; in production, send errors to a logging service (e.g., Sentry). Log all store actions (via Zustand devtools) and WebSocket events with timestamps and correlation IDs.
- **DevTools:** Zustand middleware `devtools` is enabled for time‑travel debugging.
- **Event tracing:** Each WS event includes a `trace_id` (optional, can be generated client‑side) to correlate events.

---

## 9. Implementation Plan

**Phase 1 – Foundation (Week 1)**
- Define `tournament.types.ts`, `tournamentStore`.
- Extend `useGameWebSocket` with tournament event handlers and logging.
- Implement `useTournament` hook.

**Phase 2 – Lobby & Registration (Week 2)**
- Build `TournamentList`, `TournamentCard`, `TournamentBuyInDialog`.
- Integrate REST endpoints and optimistic updates with error mapping.

**Phase 3 – In‑Game HUD (Week 3)**
- Build `TournamentHUD` and sub‑components.
- Integrate into `TablePage` wrapper.
- `BlindLevelNotification` and elimination toast.

**Phase 4 – MTT & Spectator (Week 4)**
- `TableOverviewPanel` with virtualisation.
- `TableChangeAlert` and final table banner (derived from `playersRemaining <= 9`).
- Spectator table switching.

**Phase 5 – Completion & Polish (Week 5)**
- `TournamentResultsModal` with celebration.
- Polish animations, error handling, logging.
- E2E tests.

---

## 10. Testing Strategy

- **Unit tests:** Store actions, selectors, hooks (using `vitest`).
- **Integration tests:** Registration flow (mocking WS and API) to verify optimistic updates and reconciliation.
- **E2E tests:** Full tournament cycle (using Playwright) – registration, playing a hand, completion, and result display.
- **Performance tests:** Use Lighthouse and React DevTools Profiler to ensure HUD updates stay under 16ms.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| High frequency of tournament state updates causing re‑renders | Use selectors and memoisation; batch updates if necessary |
| WebSocket reconnection losing tournament context | `useTournament` resubscribes on reconnect; server resends `TournamentState` |
| Table overview panel becoming slow with 100+ tables | Virtualisation; lazy loading |
| User disconnects during tournament and reconnects after being moved | Server sends `TournamentTableChanged` on reconnect if needed |
| Optimistic update mismatch with WS event | Set a 5‑second timeout to refetch tournament state if WS confirmation doesn't arrive |

---

## 12. Conclusion

This specification is **fully aligned** with the existing backend codebase:
- All REST endpoints are already implemented in `sb-rest-router/src/tournament_routes.rs`.
- All WebSocket events are already defined in `sb-table-registry/src/game_room.rs`.
- The tournament logic (`SitGoTournament`, `MttDirector`) is already implemented in `sb-tournament`.
- Final table detection is correctly derived from `playersRemaining <= 9` in `TournamentState`.

The frontend implementation will extend the existing cash‑game UI with tournament‑specific components, store, and hooks. The architecture is modular, performance‑optimised, and ready for production. All review feedback has been incorporated, including:
- Explicit error mapping for all `AppError` variants.
- Removal of the non‑existent `/payouts` endpoint.
- Correction of final table detection (derived from `TournamentState`).
- Added logging guidance for store actions and WS events.
