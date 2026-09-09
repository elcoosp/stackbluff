import { tournamentApi } from '@stackbluff/shared/api/tournamentApi';
import type { TournamentStatus } from '@stackbluff/shared/types/tournament.types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const REFRESH_INTERVAL_MS = 10_000;

export function useTournamentsQuery(filter?: { status?: TournamentStatus; type?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tournaments', filter?.status, filter?.type],
    queryFn: async () => {
      try {
        const result = await tournamentApi.list(filter?.type ? { type: filter.type } : undefined);
        return result || [];
      } catch (error) {
        console.error('Failed to fetch tournaments:', error);
        return [];
      }
    },
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: REFRESH_INTERVAL_MS,
    retry: 2,
    retryDelay: 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tournaments'] });
  };

  return { ...query, invalidate };
}
