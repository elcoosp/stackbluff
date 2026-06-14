import { create } from 'zustand';
export interface Seat { seat_index: number; display_name: string; stack: number; current_bet: number; is_active: boolean; avatar_url?: string; hole_cards?: any[]; position_badge?: string; }
export interface Card { rank: string; suit: string; }
export interface Winner { seat: number; amount: number; cards?: [Card, Card]; }
export interface ActionRequired { min_raise: number; max_raise: number; to_call: number; remaining_ms: number; }
export interface ActionBroadcast { seat: number; bet_amount: number; new_stack: number; new_pot: number; new_side_pots: any[]; }
export interface TableState { seats: Seat[]; community_cards: Card[]; pot: number; side_pots: any[]; round: string; hero_seat: number; hero_hole_cards?: [Card, Card]; }
interface GameState { /* same as before */ }
export const useGameStore = create<GameState>((set) => ({
  tableId: null, seats: {}, communityCards: [], pot: 0, sidePots: [], currentRound: 'preflop', heroSeat: null, heroHoleCards: null,
  actionRequired: false, minRaise: 0, maxRaise: 0, toCall: 0, timeRemainingMs: null, winners: null,
  setSnapshot: (snapshot) => set({ seats: Object.fromEntries(snapshot.seats.map(s => [s.seat_index, s])), communityCards: snapshot.community_cards, pot: snapshot.pot, sidePots: snapshot.side_pots, currentRound: snapshot.round, heroSeat: snapshot.hero_seat, heroHoleCards: snapshot.hero_hole_cards, actionRequired: false, winners: null }),
  setHeroHoleCards: (cards) => set({ heroHoleCards: cards }),
  applyActionBroadcast: (broadcast) => set((state) => { const newSeats = { ...state.seats }; const seat = newSeats[broadcast.seat]; if (seat) { seat.stack = broadcast.new_stack; seat.current_bet = broadcast.bet_amount; } return { seats: newSeats, pot: broadcast.new_pot, sidePots: broadcast.new_side_pots }; }),
  setActionRequired: (required) => set({ actionRequired: true, minRaise: required.min_raise, maxRaise: required.max_raise, toCall: required.to_call, timeRemainingMs: required.remaining_ms }),
  clearActionRequired: () => set({ actionRequired: false, timeRemainingMs: null }),
  setHandResult: (result) => set({ winners: result.winners, actionRequired: false, timeRemainingMs: null }),
  reset: () => set({ seats: {}, communityCards: [], pot: 0, sidePots: [], heroHoleCards: null, actionRequired: false, winners: null }),
}));
