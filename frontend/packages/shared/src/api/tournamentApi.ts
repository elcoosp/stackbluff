import type { TournamentResult, TournamentSummary } from '../types/tournament.types';
import { apiClient } from './client';

export const tournamentApi = {
  list: async (params?: { type?: string; status?: string }): Promise<TournamentSummary[]> => {
    let url = '/tournaments';
    if (params) {
      const query = new URLSearchParams();
      if (params.type) query.append('type', params.type);
      if (params.status) query.append('status', params.status);
      const qs = query.toString();
      if (qs) url += `?${qs}`;
    }
    return apiClient<TournamentSummary[]>(url);
  },

  get: (id: string) => apiClient<TournamentSummary>(`/tournaments/${id}`),

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
    apiClient<TournamentResult>(`/tournaments/${tournamentId}/results`),

  getPayoutStructure: (tournamentId: string) =>
    apiClient<TournamentSummary>(`/tournaments/${tournamentId}`).then(
      (res) => res.payout_structure || [],
    ),
  getMyTable: (tournamentId: string) =>
    apiClient<{ table_id: string | null; status: string }>(`/tournaments/${tournamentId}/my-table`),
};
