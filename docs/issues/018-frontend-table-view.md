---
title: Frontend table view – Complete responsive poker table (mobile U‑shape / desktop rounded rectangle) with shadcn/ui, Framer Motion, WebSocket, and TanStack
labels: frontend, ui, websocket, responsive, shadcn, animation
blocked_by: 005, 006, 009
---

## Context

We have two high‑fidelity mockups:
- **Mobile** (`code.html`): U‑shaped seat arrangement, bottom action sheet, compact analytics bar.
- **Desktop** (attached separately): **Rounded rectangle** table shape (elongated with rounded corners), seats placed around the perimeter, action buttons inline, side analytics panel.

Design system: **Obsidian Steel** (`DESIGN.md`) – dark “Stealth Wealth” aesthetic with razor highlights, emerald tertiary, glassmorphism, carbon texture.

Tech stack already in use:
- **shadcn/ui** – component library (Button, Slider, Card, Dialog, Avatar, Badge, Progress) – already installed in the monorepo.
- **Tailwind CSS** – styled with the Obsidian Steel preset.
- **Framer Motion** – for all animations (micro‑interactions, layout transitions).
- **TanStack Router** – type‑safe routing.
- **TanStack Query** – server state (lobby).
- **TanStack Form** – raise slider validation.
- **Zustand** – high‑frequency game state.
- **WebSocket** – real‑time game updates (messages from `sb-ws-messages`).

**Goal**: Build a fully responsive poker table page that:
- Uses **shadcn/ui components** as the base, fully customised with Obsidian Steel tokens.
- Adds **Framer Motion** animations to shadcn components for premium feel.
- Seamlessly switches between **mobile U‑shape** and **desktop rounded rectangle** layouts with animated transitions.
- Implements all poker features: table sync, hole cards, action timer, raise limits, side pots, showdown, reconnect.

---

## 1. Design System: Adapting shadcn/ui to Obsidian Steel

### 1.1 Tailwind preset (shared)

Create `packages/shared/tailwind-preset.ts` with all tokens from `DESIGN.md` (colours, fonts, radii, spacing, box shadows, keyframes).  

**Critical additions for desktop rounded rectangle**:
- Add custom `aspect-ratio` utilities: `aspect-table-desktop: 16/9` (or similar) to give the table a rounded rectangle shape.
- Use `rounded-2xl` or `rounded-3xl` for the table container.

### 1.2 shadcn/ui theme override

In `apps/mini-app/src/index.css` (or global styles), override shadcn CSS variables to match Obsidian Steel:

```css
@layer base {
  :root {
    --background: 0 0% 7%;      /* #131313 */
    --foreground: 0 0% 89%;     /* #e2e2e2 */
    --card: 0 0% 9%;            /* #1f1f1f */
    --card-foreground: 0 0% 89%;
    --popover: 0 0% 9%;
    --popover-foreground: 0 0% 89%;
    --primary: 240 5% 79%;      /* #c6c6cf */
    --primary-foreground: 240 8% 20%;
    --secondary: 240 3% 53%;    /* #c7c6c9 */
    --secondary-foreground: 0 0% 19%;
    --muted: 0 0% 15%;
    --muted-foreground: 0 0% 70%;
    --accent: 158 70% 51%;      /* #4edea3 (tertiary) */
    --accent-foreground: 156 100% 11%;
    --destructive: 0 100% 67%;  /* #ffb4ab */
    --destructive-foreground: 0 100% 20%;
    --border: 0 0% 20%;         /* #353535 */
    --input: 0 0% 20%;
    --ring: 158 70% 51%;
    --radius: 0.5rem;
  }
  .dark { /* same values */ }
}
```

### 1.3 Wrapping shadcn components with Framer Motion

Create `@stackbluff/shared/ui/motion-wrappers.tsx`:

```tsx
import { motion } from 'framer-motion';
import { Button, ButtonProps } from './ui/button';
import { Slider, SliderProps } from './ui/slider';
import { Dialog, DialogContent, DialogProps } from './ui/dialog';
import { Progress, ProgressProps } from './ui/progress';

export const MotionButton = motion.create(Button);
export const MotionSlider = motion.create(Slider);
export const MotionDialog = motion.create(Dialog);
export const MotionDialogContent = motion.create(DialogContent);
export const MotionProgress = motion.create(Progress);
```

---

## 2. UI Components: Modular Decomposition (using shadcn/ui + Framer Motion)

### 2.1 Primitives (built with shadcn primitives)

| Component | shadcn base | Framer Motion additions | Custom styling (Obsidian Steel) |
|-----------|-------------|-------------------------|--------------------------------|
| `Card` (playing card) | `Card` (heavily customised) | `motion.div` with flip, deal, hover scale | White background, red/black suits, rounded `sm`, custom shadows |
| `CardBack` | `Card` | `motion.div` with idle float, hover glow | Linear gradient + repeating‑linear‑gradient pattern |
| `ChipStack` | `Badge` (or `div`) | `motion.div` with height spring | Tertiary text, border, emerald glow |
| `PlayerAvatar` | `Avatar` + `AvatarImage` + `AvatarFallback` | `motion.div` with pulse ring | Ring uses `ring-accent` and `ring-offset-background` |
| `ActionButton` | `Button` from shadcn | `MotionButton` with `whileTap={{ scale: 0.92 }}` | Variants: `fold` (destructive), `call` (accent), `raise` (outline), `allin` (destructive‑outline) |
| `RaiseSlider` | `Slider` from shadcn | `MotionSlider` with drag spring | Custom thumb and track styles using Obsidian tokens |
| `TimerBar` | `Progress` from shadcn | `MotionProgress` with animated width | Progress indicator uses `bg-accent` with `pulse-line` animation |
| `PotBadge` | `Card` (small) | `motion.div` with pop‑in scale | Glassmorphic background (`bg-background/80 backdrop-blur-sm`) |
| `Badge` | `Badge` from shadcn | `motion.span` with float animation | Variants: `dealer` (gold gradient), `co` (silver gradient) |
| `GlassHub` | `Card` with `backdrop-blur-md bg-background/80` | `motion.div` with fade‑in scale | Border, shadow, active state with emerald glow |

### 2.2 Composite components

| Component | Composed of | Responsive layout | Animations |
|-----------|-------------|-------------------|-------------|
| `PlayerSpot` | Avatar, ChipStack, two Cards/Badges, Badge | Position changes via parent | Cards deal (staggered), stack spring |
| `CommunityCards` | 5 Cards | Centered, scales on mobile | Sequential flip (stagger) |
| `SeatGrid` | 6–9 PlayerSpots | Mobile: U‑shape; Desktop: positions around rounded rectangle | `layout` prop + absolute positioning |
| `ActionBar` | ActionButtons, RaiseSlider (in Dialog for mobile) | Mobile: bottom sheet (Dialog); Desktop: inline row | Spring slide‑up/down |
| `AnalyticsPanel` | Cards with Progress, Badges | Horizontal bar (mobile), vertical side panel (desktop) | Crossfade + width spring |
| `TableFelt` | Radial gradient + felt texture | Scales with container | Pulse glow on pot increase |
| `TableRail` | Metallic border with inner shadows | Fixed dimensions | Static |

---

## 3. Responsive Layout Implementation

### 3.1 Hook `useResponsiveLayout`

```ts
// mini-app/src/hooks/useResponsiveLayout.ts
import { useEffect, useState } from 'react';

export function useResponsiveLayout() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}
```

### 3.2 Seat positioning functions

**Mobile (U‑shape)**: positions based on seat index (0,1,2 top row, 3 left middle, 4 right middle, 5 bottom hero). Use percentages.

**Desktop (rounded rectangle)**: seats are placed along the perimeter of a rounded rectangle. Use parametric equations:

```ts
function getDesktopPosition(index: number, total: number) {
  // t from 0 to 1, starting at left side of top edge, moving clockwise
  const t = index / total;
  // Perimeter sections: top edge (0-0.25), right edge (0.25-0.5), bottom edge (0.5-0.75), left edge (0.75-1)
  const width = 80; // % of parent
  const height = 60; // %
  const cornerRadius = 20; // % of min(width,height)
  // Simplified: place points on an ellipse with rounded corners
  const angle = t * 2 * Math.PI;
  const x = 50 + (width/2) * Math.cos(angle);
  const y = 50 + (height/2) * Math.sin(angle);
  return { left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' };
}
```

For exact mockup, positions can be hardcoded for 6‑max or 9‑max based on the design file.

### 3.3 SeatGrid component with layout transition

```tsx
import { motion } from 'framer-motion';
import { PlayerSpot } from './PlayerSpot';

export const SeatGrid = ({ seats, heroSeat, isDesktop }: SeatGridProps) => {
  const seatArray = Object.values(seats).sort((a,b) => a.index - b.index);
  return (
    <motion.div layout className="relative w-full h-full">
      {seatArray.map((seat) => (
        <motion.div
          key={seat.index}
          layout
          className="absolute"
          style={isDesktop ? getDesktopPosition(seat.index, seatArray.length) : getMobilePosition(seat.index)}
        >
          <PlayerSpot seat={seat} isHero={heroSeat === seat.index} />
        </motion.div>
      ))}
    </motion.div>
  );
};
```

### 3.4 ActionBar: Mobile uses shadcn Dialog as bottom sheet

```tsx
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MotionButton } from '@/components/ui/motion-wrappers';

export const ActionBar = ({ isDesktop, ...props }) => {
  if (isDesktop) {
    return <DesktopActionBar {...props} />;
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="fixed bottom-4 left-1/2 -translate-x-1/2">Actions</Button>
      </DialogTrigger>
      <DialogContent className="bottom-0 top-auto translate-y-0 rounded-t-xl">
        <MobileActionPanel {...props} />
      </DialogContent>
    </Dialog>
  );
};
```

---

## 4. State Management (Zustand) – Complete

```ts
// packages/shared/stores/gameStore.ts
import { create } from 'zustand';
import { Card, Seat, Winner, ActionRequired, TableState, ActionBroadcast, HandResult } from 'sb-ws-messages';

interface GameState {
  tableId: string | null;
  seats: Record<number, Seat>;
  communityCards: Card[];
  pot: number;
  sidePots: Array<{ amount: number; eligibleSeats: number[] }>;
  currentRound: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  heroSeat: number | null;
  heroHoleCards: [Card, Card] | null;
  actionRequired: boolean;
  minRaise: number;
  maxRaise: number;
  toCall: number;
  timeRemainingMs: number | null;
  winners: Winner[] | null;

  setSnapshot: (snapshot: TableState) => void;
  setHeroHoleCards: (cards: [Card, Card]) => void;
  applyActionBroadcast: (broadcast: ActionBroadcast) => void;
  setActionRequired: (required: ActionRequired) => void;
  clearActionRequired: () => void;
  setHandResult: (result: HandResult) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  tableId: null,
  seats: {},
  communityCards: [],
  pot: 0,
  sidePots: [],
  currentRound: 'preflop',
  heroSeat: null,
  heroHoleCards: null,
  actionRequired: false,
  minRaise: 0,
  maxRaise: 0,
  toCall: 0,
  timeRemainingMs: null,
  winners: null,

  setSnapshot: (snapshot) => set({
    seats: snapshot.seats,
    communityCards: snapshot.community_cards,
    pot: snapshot.pot,
    sidePots: snapshot.side_pots,
    currentRound: snapshot.round,
    heroSeat: snapshot.hero_seat,
    heroHoleCards: snapshot.hero_hole_cards,
    actionRequired: false,
    winners: null,
  }),

  setHeroHoleCards: (cards) => set({ heroHoleCards: cards }),

  applyActionBroadcast: (broadcast) => set((state) => {
    const newSeats = { ...state.seats };
    const seat = newSeats[broadcast.seat];
    if (seat) {
      seat.stack = broadcast.new_stack;
      seat.current_bet = broadcast.bet_amount;
    }
    return {
      seats: newSeats,
      pot: broadcast.new_pot,
      sidePots: broadcast.new_side_pots,
    };
  }),

  setActionRequired: (required) => set({
    actionRequired: true,
    minRaise: required.min_raise,
    maxRaise: required.max_raise,
    toCall: required.to_call,
    timeRemainingMs: required.remaining_ms,
  }),

  clearActionRequired: () => set({
    actionRequired: false,
    timeRemainingMs: null,
  }),

  setHandResult: (result) => set({
    winners: result.winners,
    actionRequired: false,
    timeRemainingMs: null,
  }),

  reset: () => set({
    seats: {},
    communityCards: [],
    pot: 0,
    sidePots: [],
    heroHoleCards: null,
    actionRequired: false,
    winners: null,
  }),
}));
```

---

## 5. WebSocket Hook (Complete)

```ts
// mini-app/src/hooks/useGameWebSocket.ts
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { useUserStore } from '@stackbluff/shared/stores/userStore';
import { parseMessage, isTableState, isHandDealt, isActionRequired, isActionBroadcast, isHandResult } from 'sb-ws-messages';
import { useToast } from '@/components/ui/use-toast';

export function useGameWebSocket(tableId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const { toast } = useToast();
  const { setSnapshot, setHeroHoleCards, setActionRequired, applyActionBroadcast, setHandResult, clearActionRequired } = useGameStore();
  const token = useUserStore((state) => state.user?.id); // assume JWT stored

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`wss://host/ws/game?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      ws.send(JSON.stringify({ type: 'join_table', table_id: tableId }));
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const message = parseMessage(data);
      if (isTableState(message)) setSnapshot(message);
      else if (isHandDealt(message)) setHeroHoleCards(message.cards);
      else if (isActionRequired(message)) setActionRequired(message);
      else if (isActionBroadcast(message)) applyActionBroadcast(message);
      else if (isHandResult(message)) setHandResult(message);
      else if (message.type === 'error') {
        console.error('WebSocket error', message);
        toast({ title: 'Game error', description: message.message, variant: 'destructive' });
      }
    };

    ws.onclose = () => {
      setConnectionStatus('reconnecting');
      toast({ title: 'Disconnected', description: 'Reconnecting...', variant: 'default' });
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => console.error('WebSocket error', err);
  };

  const sendAction = (action: 'fold' | 'check' | 'call' | 'raise' | 'all-in', amount?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'player_action', action, amount }));
      clearActionRequired(); // optimistic disable
    }
  };

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [tableId, token]);

  return { sendAction, connectionStatus };
}
```

---

## 6. TanStack Suite Integration

### 6.1 Router setup

```ts
// mini-app/src/routes/index.tsx
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { LobbyPage } from '../pages/LobbyPage';
import { TablePage } from '../pages/TablePage';

const rootRoute = createRootRoute();

const lobbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LobbyPage,
});

const tableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/table/$tableId',
  component: TablePage,
});

const routeTree = rootRoute.addChildren([lobbyRoute, tableRoute]);
export const router = createRouter({ routeTree });
```

### 6.2 Query for lobby

```ts
const { data: tables, isLoading, refetch } = useQuery({
  queryKey: ['lobby'],
  queryFn: fetchLobby,
  staleTime: 30000,
});
```

### 6.3 Form for raise slider (using shadcn Slider + TanStack Form)

```tsx
import { useForm } from '@tanstack/react-form';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

const raiseForm = useForm({
  defaultValues: { amount: minRaise },
  validators: {
    onChange: ({ value }) => value >= minRaise && value <= maxRaise,
  },
  onSubmit: ({ value }) => onRaise(value.amount),
});

<raiseForm.Field name="amount">
  {(field) => (
    <>
      <Slider
        value={[field.state.value]}
        min={minRaise}
        max={maxRaise}
        step={bigBlind}
        onValueChange={(vals) => field.handleChange(vals[0])}
      />
      <div className="flex gap-2">
        <Button onClick={() => field.handleChange(Math.floor(pot * 0.5))}>½ POT</Button>
        <Button onClick={() => field.handleChange(Math.floor(pot * 0.75))}>¾ POT</Button>
        <Button onClick={() => field.handleChange(pot)}>POT</Button>
        <Button onClick={() => field.handleChange(maxRaise)}>MAX</Button>
      </div>
    </>
  )}
</raiseForm.Field>
```

---

## 7. Implementation Steps (34 detailed steps)

1. Create Tailwind preset in shared package with all Obsidian Steel tokens.
2. Configure both apps (`mini-app`, `pwa`) to use the preset.
3. Override shadcn CSS variables in global styles to match Obsidian Steel.
4. Install `framer-motion` and create `motion-wrappers.tsx` for shadcn components.
5. Implement `Card` (playing card) using shadcn `Card` + Framer Motion (flip animation, deal).
6. Implement `CardBack` similarly.
7. Implement `ChipStack` using shadcn `Badge` + motion height spring.
8. Implement `PlayerAvatar` using shadcn `Avatar` + motion pulse ring.
9. Implement `ActionButton` as `MotionButton` with variants (fold, call, raise, all‑in).
10. Implement `RaiseSlider` as `MotionSlider` with TanStack Form integration.
11. Implement `TimerBar` as `MotionProgress` with animated width.
12. Implement `PotBadge` as `Card` with pop‑in scale animation.
13. Implement `Badge` as shadcn `Badge` + motion float.
14. Implement `GlassHub` as `Card` with backdrop blur and fade‑in scale.
15. Implement `RazorDivider` as `div` with custom border.
16. Implement `PlayerSpot` composite (avatar, chips, cards, badges).
17. Implement `CommunityCards` with staggered flip (use `staggerChildren`).
18. Implement `SeatGrid` with two positioning functions (U‑shape for mobile, rounded rectangle for desktop) using `layout` animation.
19. Implement `ActionBar` with mobile `Dialog` (bottom sheet) and desktop inline row.
20. Implement `AnalyticsPanel` with responsive orientation (horizontal for mobile, vertical for desktop).
21. Implement `TableFelt` (radial gradient + felt texture) and `TableRail` (metallic border).
22. Create Zustand game store (full code above).
23. Implement `useGameWebSocket` hook (full code above).
24. Set up TanStack Router, Query, Form providers in `main.tsx`.
25. Build `TablePage` assembling all composites, using `useResponsiveLayout`.
26. Add lobby `useQuery` migration (replace direct fetch).
27. Add create table `useMutation`.
28. Implement raise slider presets (½, ¾, pot, max) with TanStack Form.
29. Implement timer bar using `requestAnimationFrame` and Framer Motion `MotionProgress`.
30. Add disconnect toast and reconnection logic.
31. Ensure desktop layout uses rounded rectangle shape (`rounded-3xl` + custom aspect ratio).
32. Write unit tests for all primitives and composites (Vitest + Testing Library).
33. Write integration test for WebSocket hook using mock server.
34. Perform responsive testing on mobile (375px, iPhone SE), tablet (768px), and desktop (1440px) to verify layout transitions.

---

## 8. Acceptance Criteria (exhaustive, no placeholders)

- [ ] **shadcn/ui usage** – all interactive elements are shadcn components (Button, Slider, Avatar, Badge, Progress, Dialog, Card). No raw HTML inputs or unstyled divs for interactive elements.
- [ ] **Motion enhancements** – every shadcn component that needs animation is wrapped with Framer Motion (`MotionButton`, `MotionSlider`, `MotionProgress`, etc.). All micro‑interactions (hover, tap, focus) have spring physics.
- [ ] **Mobile layout (<768px)** – seats form a U‑shape exactly as in `code.html`. Hero seat bottom center, opponents top row and side seats. Action bar uses shadcn `Dialog` as a bottom sheet that slides up. Analytics panel is a horizontal `Card` below the table with win %, pot odds, best combo, and strength bar.
- [ ] **Desktop layout (≥768px)** – table is a **rounded rectangle** (not oval). Seats are placed around the perimeter (top, right, bottom, left). Action buttons are inline as a row near the hero seat (or under the table). Analytics panel is a vertical side panel on the right edge.
- [ ] **Layout transition** – when resizing from mobile to desktop (or vice versa), all seats animate smoothly to their new positions using Framer Motion `layout`. Action bar and analytics panel crossfade using `AnimatePresence` without sudden jumps or flickering.
- [ ] **WebSocket connection** – on mount, connects with JWT from `useUserStore` and sends `join_table`. If connection drops, shows “Reconnecting…” toast and attempts exponential backoff (starting 1s, max 15s). After reconnect, re‑sends `join_table` and receives full `table.state`.
- [ ] **Table state sync** – `table.state` populates seats (stacks, current bets), community cards, pot, side pots, hero hole cards, and current round.
- [ ] **Hole cards** – hero sees his two cards face up; all opponent cards are face down (`CardBack`).
- [ ] **Action required** – when `action.required` arrives, action buttons become enabled, the “Call” button shows the exact `to_call` amount, raise slider is bounded to `min_raise` and `max_raise`, and the timer bar starts counting down from `remaining_ms`.
- [ ] **Timer bar** – uses `requestAnimationFrame` to update a Framer Motion `width` animation on a shadcn `Progress` component. When timer reaches 0, buttons are disabled (server already folded). Timer resets on new `action.required`.
- [ ] **Raise slider** – integrated with TanStack Form; validates that amount is within min/max. Preset buttons (½ pot, ¾ pot, pot, max) update the slider value. On confirm, sends `player_action` with `raise` and the amount.
- [ ] **Opponent actions** – `action.broadcast` updates the relevant seat’s stack and current bet, updates total pot and side pots. UI reflects these changes immediately.
- [ ] **Showdown** – `hand.result` displays a shadcn `Dialog` (or similar) listing winners, their amounts, and (if provided) showdown cards. After closing, the table resets for the next hand.
- [ ] **Disconnect / reconnect** – if the WebSocket closes unexpectedly, the connection status changes to “reconnecting”, action buttons are disabled. Once reconnected, the user remains at the same table and sees the full current state.
- [ ] **Performance** – timer does not cause React re‑renders every frame; Framer Motion handles animation. Only store updates trigger necessary component re‑renders (using selective subscriptions in Zustand). No layout thrashing during resize.
- [ ] **Accessibility** – shadcn components provide built‑in ARIA attributes. Additional `aria-label` on action buttons, slider is keyboard operable (arrow keys). Timer bar has `aria-valuemin`, `aria-valuemax`, `aria-valuenow`.
- [ ] **Touch targets** – on mobile, action buttons have minimum 44×44pt touch area (shadcn `Button` with `size="lg"`). Slider thumb is large enough for finger drag.
- [ ] **Visual fidelity** – matches `code.html` (mobile) and desktop mockup exactly (colours, fonts, shadows, glass effect, carbon texture, emerald glow). Desktop table has **rounded rectangle** shape with smooth corners.

---

## 9. Blocked by

- **#005 WebSocket baseline** – server endpoint, JWT auth, message schema.
- **#006 Frontend scaffold** – shadcn/ui already installed, but Tailwind preset and TanStack need final configuration.
- **#009 Table actor loop** – server sends correct `action.required` with min/max and timer.

---

## 10. Dependencies & References

- **Mockups**: `code.html` (mobile), desktop mockup (attached – rounded rectangle table).
- **Design system**: `DESIGN.md`.
- **shadcn/ui**: https://ui.shadcn.com (Button, Slider, Card, Dialog, Avatar, Badge, Progress).
- **Framer Motion**: https://www.framer.com/motion/.
- **TanStack**: Router, Query, Form.
- **Zustand**: state management.
- **WebSocket types**: `sb-ws-messages`.
