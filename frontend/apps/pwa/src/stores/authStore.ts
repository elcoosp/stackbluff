import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AuthState {
  userId: string | null;
  balance: number;
  seasonPassExpiresAt: string | null;
  clubProExpiresAt: string | null;
  isClubOwner: boolean;
  setBalance: (balance: number) => void;
  setSeasonPassExpiresAt: (date: string | null) => void;
  setClubProExpiresAt: (date: string | null) => void;
  setIsClubOwner: (owns: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      userId: null,
      balance: 0,
      seasonPassExpiresAt: null,
      clubProExpiresAt: null,
      isClubOwner: false,
      setBalance: (balance) => set({ balance }),
      setSeasonPassExpiresAt: (seasonPassExpiresAt) => set({ seasonPassExpiresAt }),
      setClubProExpiresAt: (clubProExpiresAt) => set({ clubProExpiresAt }),
      setIsClubOwner: (isClubOwner) => set({ isClubOwner }),
    }),
    { name: 'auth-store' }
  )
);
