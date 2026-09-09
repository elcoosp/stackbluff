import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface Badge {
  badge_type: string;
  awarded_at: string;
}

const BADGES_QUERY_KEY = ['badges'];

export function useBadges() {
  return useQuery<Badge[]>({
    queryKey: BADGES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/users/me/badges', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Failed to fetch badges: ${res.status}`);
      const data = await res.json();
      return data.badges as Badge[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUserBadges(userId: string) {
  return useQuery<Badge[]>({
    queryKey: [...BADGES_QUERY_KEY, userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/badges`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Failed to fetch user badges: ${res.status}`);
      const data = await res.json();
      return data.badges as Badge[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvalidateBadges() {
  const queryClient = useQueryClient();
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey: BADGES_QUERY_KEY }),
    invalidateUser: (userId: string) =>
      queryClient.invalidateQueries({ queryKey: [...BADGES_QUERY_KEY, userId] }),
  };
}
