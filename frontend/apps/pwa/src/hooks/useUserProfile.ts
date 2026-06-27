import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useEntitlementsStore } from '../stores/entitlementsStore';
import { fetchUserMe } from '../lib/shopApi';

export function useUserProfile() {
  const auth = useAuthStore();
  const entitlements = useEntitlementsStore();

  return useQuery({
    queryKey: ['user-me'],
    queryFn: async () => {
      const user = await fetchUserMe();
      auth.setBalance(user.balance);
      entitlements.setSeasonPassExpiresAt(user.season_pass_expires_at);
      entitlements.setClubProExpiresAt(user.club_pro_expires_at);
      entitlements.setIsClubOwner(user.is_club_owner);
      return user;
    },
    staleTime: 1000 * 30,
    onError: (err) => {
      console.error('[User] Failed to fetch profile:', err);
    },
  });
}
