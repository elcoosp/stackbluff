import { create } from 'zustand';
import type { Card, Seat, Winner, ActionRequired, TableState, ActionBroadcast, HandResult } from 'sb-ws-messages';

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
    seats: Object.fromEntries(snapshot.seats.map(s => [s.seat_index, s])),
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
    if (seat) { seat.stack = broadcast.new_stack; seat.current_bet = broadcast.bet_amount; }
    return { seats: newSeats, pot: broadcast.new_pot, sidePots: broadcast.new_side_pots };
  }),
  setActionRequired: (required) => set({ actionRequired: true, minRaise: required.min_raise, maxRaise: required.max_raise, toCall: required.to_call, timeRemainingMs: required.remaining_ms }),
  clearActionRequired: () => set({ actionRequired: false, timeRemainingMs: null }),
  setHandResult: (result) => set({ winners: result.winners, actionRequired: false, timeRemainingMs: null }),
  reset: () => set({ seats: {}, communityCards: [], pot: 0, sidePots: [], heroHoleCards: null, actionRequired: false, winners: null }),
}));
