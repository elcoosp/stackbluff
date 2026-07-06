import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AuthState {
  userId: string | null;
  balance: number;
  setBalance: (balance: number) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      userId: null,
      balance: 0,
      setBalance: (balance) => set({ balance }),
    }),
    { name: 'auth-store' }
  )
);
