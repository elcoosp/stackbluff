import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  total_chips_won: number;
  rank: number;
  badges?: string[];
}

export const LEADERBOARD_QUERY_KEY = ['leaderboard', 'global'] as const;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

async function fetchLeaderboard(offset = 0): Promise<LeaderboardEntry[]> {
  const res = await fetch(`/api/leaderboard/global?offset=${offset}`);
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  return res.json();
}

function reRank(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => b.total_chips_won - a.total_chips_won)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

export interface HandResultDetail {
  userId: string;
  chipsDelta: number;
}

export function useLeaderboard() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: LEADERBOARD_QUERY_KEY,
    queryFn: () => fetchLeaderboard(0),
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: REFRESH_INTERVAL_MS,
  });

  const applyOptimisticUpdate = useCallback(
    (userId: string, chipsDelta: number) => {
      queryClient.setQueryData<LeaderboardEntry[]>(LEADERBOARD_QUERY_KEY, (oldData) => {
        if (!oldData) return oldData;
        const updated = oldData.map((entry) =>
          entry.user_id === userId
            ? { ...entry, total_chips_won: entry.total_chips_won + chipsDelta }
            : entry,
        );
        return reRank(updated);
      });
    },
    [queryClient],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (Array.isArray(detail)) {
        const updates = detail as HandResultDetail[];
        queryClient.setQueryData<LeaderboardEntry[]>(LEADERBOARD_QUERY_KEY, (oldData) => {
          if (!oldData) return oldData;
          const deltaMap = new Map<string, number>();
          for (const u of updates) {
            deltaMap.set(u.userId, (deltaMap.get(u.userId) ?? 0) + u.chipsDelta);
          }
          const updated = oldData.map((entry) => {
            const delta = deltaMap.get(entry.user_id);
            return delta !== undefined
              ? { ...entry, total_chips_won: entry.total_chips_won + delta }
              : entry;
          });
          return reRank(updated);
        });
      } else if (
        detail &&
        typeof detail.userId === 'string' &&
        typeof detail.chipsDelta === 'number'
      ) {
        applyOptimisticUpdate(detail.userId, detail.chipsDelta);
      }
    };

    window.addEventListener('hand:result', handler);
    return () => window.removeEventListener('hand:result', handler);
  }, [applyOptimisticUpdate, queryClient]);

  return query;
}

export function dispatchHandResult(userId: string, chipsDelta: number): void {
  window.dispatchEvent(new CustomEvent('hand:result', { detail: { userId, chipsDelta } }));
}
