import { apiClient } from '@stackbluff/shared/api/client';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { LeaderboardResponseSchema } from '@/lib/schemas';

interface ClubLeaderboardParams {
  clubId: string;
  division?: number;
}

export function useClubLeaderboard({ clubId, division = 1 }: ClubLeaderboardParams) {
  return useQuery({
    queryKey: ['club-leaderboard', clubId, division],
    queryFn: async () => {
      logger.info('Fetching club leaderboard', { clubId, division });
      const data = await apiClient<unknown>(`/clubs/${clubId}/leaderboard?division=${division}`);
      return LeaderboardResponseSchema.parse(data);
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 120 * 1000, // 2 minutes
    retry: 2,
    enabled: !!clubId,
  });
}
