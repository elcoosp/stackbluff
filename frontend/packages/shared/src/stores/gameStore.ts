import { create } from 'zustand';

export interface Seat {
  seat: number;
  user_id: string;
  display_name: string;
  stack: number;
  current_bet: number;
  is_all_in: boolean;
  is_folded: boolean;
  is_active: boolean;
  avatar_url?: string;
  hole_cards?: any[];
  position_badge?: string;
  is_winner?: boolean;
  win_amount?: number;
  hand_description?: string;
  is_showdown_revealed?: boolean;
  winningCards?: any[];
  sitting_out?: boolean;
}

export interface Card {
  rank: string;
  suit: string;
}

export interface SidePot {
  amount: number;
  eligible_players: string[];
}

export interface Analytics {
  winProb: number;
  potOdds: number;
  bestHand: string;
  strength: number;
}

export interface ActionRequired {
  to_call: number;
  min_raise: number;
  can_check: boolean;
  pot: number;
  expires_at: number;
  timeout_ms: number;
}

export interface TableState {
  room_id: string;
  seats: Seat[];
  community_cards: Card[];
  pot: number;
  side_pots: SidePot[];
  street: string;
  current_hand_in_progress: boolean;
  current_turn_user_id: string | null;
  current_turn_expires_at: number | null;
  current_turn_timeout_ms: number | null;
}

export interface ShowdownPlayer {
  user_id: string;
  display_name: string;
  seat: number;
  hole_cards: Card[];
  hand_description: string;
  is_winner: boolean;
  win_amount: number;
  winning_cards: Card[];
}

export interface ShowdownRevealData {
  players: ShowdownPlayer[];
  community_cards: Card[];
  pot: number;
}

export interface GameRoomState {
  tableId: string | null;
  seats: Record<number, Seat>;
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
  street: string;
  currentTurnUserId: string | null;
  currentTurnExpiresAt: number | null;
  currentTurnTimeoutMs: number | null;
  heroSeat: number | null;
  heroHoleCards: [Card, Card] | null;
  actionRequired: ActionRequired | null;
  analytics: Analytics | null;
  showdownReveal: ShowdownRevealData | null;
  winners: { name: string; amount: number }[] | null;
  handInProgress: boolean;
  lastAction: { player_id: string; action: string; amount: number | null } | null;
}

const createInitialRoomState = (): GameRoomState => ({
  tableId: null,
  seats: {},
  communityCards: [],
  pot: 0,
  sidePots: [],
  street: '',
  currentTurnUserId: null,
  currentTurnExpiresAt: null,
  currentTurnTimeoutMs: null,
  heroSeat: null,
  heroHoleCards: null,
  actionRequired: null,
  analytics: null,
  showdownReveal: null,
  winners: null,
  handInProgress: false,
  lastAction: null,
});

// CRITICAL FIX: Cache a single instance of the empty state to prevent
// infinite re-render loops in Zustand when returning default values.
const EMPTY_ROOM_STATE = createInitialRoomState();

interface GameState {
  rooms: Record<string, GameRoomState>;
  activeRoomId: string | null;

  ensureRoom: (roomId: string) => void;
  setRoomState: (roomId: string, state: TableState) => void;
  setHeroSeat: (roomId: string, seat: number) => void;
  setHeroHoleCards: (roomId: string, cards: Card[]) => void;
  setActionRequired: (roomId: string, req: ActionRequired) => void;
  clearActionRequired: (roomId: string) => void;
  setAnalytics: (roomId: string, analytics: Analytics | null) => void;
  setShowdownReveal: (roomId: string, data: ShowdownRevealData | null) => void;
  applyActionBroadcast: (roomId: string, broadcast: any) => void;
  setHandResult: (roomId: string, result: { winners: any[]; pot: number }) => void;
  removeRoom: (roomId: string) => void;
  setActiveRoom: (roomId: string | null) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  rooms: {},
  activeRoomId: null,

  ensureRoom: (roomId) => set((state) => {
    if (state.rooms[roomId]) return {};
    return { rooms: { ...state.rooms, [roomId]: createInitialRoomState() } };
  }),

  setRoomState: (roomId, tableState) => set((state) => {
    if (!state.rooms[roomId]) return {};
    const seatsMap: Record<number, Seat> = {};
    tableState.seats.forEach((seat) => {
      seatsMap[seat.seat] = {
        ...seat,
        is_active: !seat.is_folded && !seat.is_all_in,
      };
    });

    return {
      rooms: {
        ...state.rooms,
        [roomId]: {
          ...state.rooms[roomId],
          tableId: tableState.room_id,
          seats: seatsMap,
          communityCards: tableState.community_cards || [],
          pot: tableState.pot || 0,
          sidePots: tableState.side_pots || [],
          street: tableState.street || '',
          currentTurnUserId: tableState.current_turn_user_id || null,
          currentTurnExpiresAt: tableState.current_turn_expires_at || null,
          currentTurnTimeoutMs: tableState.current_turn_timeout_ms || null,
          handInProgress: tableState.current_hand_in_progress || false,
        }
      }
    };
  }),

  setHeroSeat: (roomId, seat) => set((state) => {
    if (!state.rooms[roomId]) return {};
    return { rooms: { ...state.rooms, [roomId]: { ...state.rooms[roomId], heroSeat: seat } } };
  }),

  setHeroHoleCards: (roomId, cards) => set((state) => {
    if (!state.rooms[roomId]) return {};
    if (cards && cards.length === 2) {
      return { rooms: { ...state.rooms, [roomId]: { ...state.rooms[roomId], heroHoleCards: cards as [Card, Card] } } };
    }
    return {};
  }),

  setActionRequired: (roomId, req) => set((state) => {
    if (!state.rooms[roomId]) return {};
    return { rooms: { ...state.rooms, [roomId]: { ...state.rooms[roomId], actionRequired: req } } };
  }),

  clearActionRequired: (roomId) => set((state) => {
    if (!state.rooms[roomId]) return {};
    return { rooms: { ...state.rooms, [roomId]: { ...state.rooms[roomId], actionRequired: null } } };
  }),

  setAnalytics: (roomId, analytics) => set((state) => {
    if (!state.rooms[roomId]) return {};
    return { rooms: { ...state.rooms, [roomId]: { ...state.rooms[roomId], analytics } } };
  }),

  setShowdownReveal: (roomId, data) => set((state) => {
    if (!state.rooms[roomId]) return {};
    return { rooms: { ...state.rooms, [roomId]: { ...state.rooms[roomId], showdownReveal: data } } };
  }),

  applyActionBroadcast: (roomId, broadcast) => set((state) => {
    if (!state.rooms[roomId]) return {};
    const { player_id, action, amount, new_stack, new_pot } = broadcast;
    const roomState = state.rooms[roomId];

    const seatNum = Object.keys(roomState.seats).find(
      (key) => roomState.seats[Number(key)].user_id === player_id
    );
    if (seatNum === undefined) return {};

    const newSeats = { ...roomState.seats };
    const seat = newSeats[Number(seatNum)];
    if (seat) {
      seat.stack = new_stack;
    }

    return {
      rooms: {
        ...state.rooms,
        [roomId]: {
          ...roomState,
          seats: newSeats,
          pot: new_pot,
          lastAction: { player_id, action, amount },
        }
      }
    };
  }),

  setHandResult: (roomId, result) => set((state) => {
    if (!state.rooms[roomId]) return {};
    return {
      rooms: {
        ...state.rooms,
        [roomId]: {
          ...state.rooms[roomId],
          winners: result.winners,
          actionRequired: null,
          showdownReveal: null,
        }
      }
    };
  }),

  removeRoom: (roomId) => set((state) => {
    const newRooms = { ...state.rooms };
    delete newRooms[roomId];
    return {
      rooms: newRooms,
      activeRoomId: state.activeRoomId === roomId
        ? Object.keys(newRooms)[0] || null
        : state.activeRoomId
    };
  }),

  setActiveRoom: (roomId) => set({ activeRoomId: roomId }),
}));

export const useActiveRoom = () => {
  return useGameStore((state) => {
    if (!state.activeRoomId) return EMPTY_ROOM_STATE;
    return state.rooms[state.activeRoomId] || EMPTY_ROOM_STATE;
  });
};
