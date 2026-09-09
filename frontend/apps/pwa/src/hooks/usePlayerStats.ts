import { apiClient } from '@stackbluff/shared/api/client';
import { useQuery } from '@tanstack/react-query';
import type { PlayerStats } from '../types/player-stats';

export function usePlayerStats(userId: string | null) {
  return useQuery({
    queryKey: ['player-stats', userId],
    queryFn: () => apiClient<PlayerStats>(`/players/${userId}/stats`),
    enabled: !!userId,
    staleTime: 30_000,
    retry: 1,
  });
}
