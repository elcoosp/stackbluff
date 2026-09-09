import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface EntitlementsState {
  seasonPassExpiresAt: string | null;
  clubProExpiresAt: string | null;
  isClubOwner: boolean;
  setSeasonPassExpiresAt: (date: string | null) => void;
  setClubProExpiresAt: (date: string | null) => void;
  setIsClubOwner: (owns: boolean) => void;
  hasActiveSeasonPass: () => boolean;
  hasActiveClubPro: () => boolean;
}

export const useEntitlementsStore = create<EntitlementsState>()(
  devtools(
    (set, get) => ({
      seasonPassExpiresAt: null,
      clubProExpiresAt: null,
      isClubOwner: false,
      setSeasonPassExpiresAt: (seasonPassExpiresAt) => set({ seasonPassExpiresAt }),
      setClubProExpiresAt: (clubProExpiresAt) => set({ clubProExpiresAt }),
      setIsClubOwner: (isClubOwner) => set({ isClubOwner }),
      hasActiveSeasonPass: () => {
        const exp = get().seasonPassExpiresAt;
        if (!exp) return false;
        const d = new Date(exp);
        return !Number.isNaN(d.getTime()) && d > new Date();
      },
      hasActiveClubPro: () => {
        const exp = get().clubProExpiresAt;
        if (!exp) return false;
        const d = new Date(exp);
        return !Number.isNaN(d.getTime()) && d > new Date();
      },
    }),
    { name: 'entitlements-store' },
  ),
);
