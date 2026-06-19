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
  table_id: string;
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

interface GameState {
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

  // --- METHODS ---
  setTableState: (state: TableState) => void;
  setHeroSeat: (seat: number) => void;
  setHeroHoleCards: (cards: Card[]) => void;
  setActionRequired: (req: ActionRequired) => void;
  clearActionRequired: () => void;
  setAnalytics: (analytics: Analytics | null) => void;
  setShowdownReveal: (data: ShowdownRevealData | null) => void;
  applyActionBroadcast: (broadcast: {
    player_id: string;
    action: string;
    amount: number | null;
    new_stack: number;
    new_pot: number;
  }) => void;
  setHandResult: (result: { winners: { name: string; amount: number }[]; pot: number }) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
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

  setTableState: (state) => {
    const seatsMap: Record<number, Seat> = {};
    state.seats.forEach((seat) => {
      seatsMap[seat.seat] = {
        ...seat,
        is_active: !seat.is_folded && !seat.is_all_in,
      };
    });

    set({
      tableId: state.table_id,
      seats: seatsMap,
      communityCards: state.community_cards || [],
      pot: state.pot || 0,
      sidePots: state.side_pots || [],
      street: state.street || '',
      currentTurnUserId: state.current_turn_user_id || null,
      currentTurnExpiresAt: state.current_turn_expires_at || null,
      currentTurnTimeoutMs: state.current_turn_timeout_ms || null,
      handInProgress: state.current_hand_in_progress || false,
    });
  },

  setHeroSeat: (seat) => set({ heroSeat: seat }),

  setHeroHoleCards: (cards) => {
    if (cards && cards.length === 2) {
      set({ heroHoleCards: cards as [Card, Card] });
    }
  },

  setActionRequired: (req) => set({ actionRequired: req }),
  clearActionRequired: () => set({ actionRequired: null }),

  setAnalytics: (analytics) => set({ analytics }),

  setShowdownReveal: (data) => set({ showdownReveal: data }),

  applyActionBroadcast: (broadcast) => {
    const { player_id, action, amount, new_stack, new_pot } = broadcast;
    set((state) => {
      const seatNum = Object.keys(state.seats).find(
        (key) => state.seats[Number(key)].user_id === player_id
      );
      if (seatNum === undefined) return state;

      const newSeats = { ...state.seats };
      const seat = newSeats[Number(seatNum)];
      if (seat) {
        seat.stack = new_stack;
      }
      return {
        seats: newSeats,
        pot: new_pot,
        lastAction: { player_id, action, amount },
      };
    });
  },

  setHandResult: (result) => {
    set({
      winners: result.winners,
      actionRequired: null,
      showdownReveal: null,
    });
  },

  reset: () => {
    set({
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
  },
}));
