import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  PayoutEntry,
  TournamentResult,
  TournamentState,
  TournamentSummary,
} from '../types/tournament.types';

interface TournamentStore {
  tournaments: Record<string, TournamentSummary>;
  activeTournamentId: string | null;
  tournamentStates: Record<string, TournamentState>;
  results: Record<string, TournamentResult['results']>;
  registeredUsers: Record<string, Record<string, boolean>>;
  payouts: Record<string, PayoutEntry[]>;

  // actions
  setTournament: (id: string, data: Partial<TournamentSummary>) => void;
  setTournamentState: (id: string, data: Partial<TournamentState>) => void;
  setActiveTournament: (id: string | null) => void;
  setResults: (id: string, results: TournamentResult['results']) => void;
  setRegistered: (tournamentId: string, userId: string, registered: boolean) => void;
  setPayouts: (tournamentId: string, payouts: PayoutEntry[]) => void;
  clearTournament: (id: string) => void;
}

export const useTournamentStore = create<TournamentStore>()(
  devtools(
    (set) => ({
      tournaments: {},
      activeTournamentId: null,
      tournamentStates: {},
      results: {},
      registeredUsers: {},
      payouts: {},

      setTournament: (id, data) =>
        set((state) => ({
          tournaments: {
            ...state.tournaments,
            [id]: { ...state.tournaments[id], ...data } as TournamentSummary,
          },
        })),

      setTournamentState: (id, data) =>
        set((state) => ({
          tournamentStates: {
            ...state.tournamentStates,
            [id]: { ...state.tournamentStates[id], ...data } as TournamentState,
          },
        })),

      setActiveTournament: (id) => set({ activeTournamentId: id }),

      setResults: (id, results) =>
        set((state) => ({
          results: { ...state.results, [id]: results },
        })),

      setRegistered: (tournamentId, userId, registered) =>
        set((state) => ({
          registeredUsers: {
            ...state.registeredUsers,
            [tournamentId]: {
              ...state.registeredUsers[tournamentId],
              [userId]: registered,
            },
          },
        })),

      setPayouts: (tournamentId, payouts) =>
        set((state) => ({
          payouts: { ...state.payouts, [tournamentId]: payouts },
        })),

      clearTournament: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.tournaments;
          return { tournaments: rest };
        }),
    }),
    { name: 'tournamentStore' },
  ),
);
