import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  balance: number;
  setAuth: (user: User, token: string, balance: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      balance: 0,
      setAuth: (user, token, balance) => set({ user, token, balance: balance || 0 }),
      logout: () => set({ user: null, token: null, balance: 0 }),
    }),
    { name: 'auth-storage' }
  )
);
