import { create } from 'zustand';
import { apiClient } from '../api/client';

interface User {
  id: string;
  username: string;
  email?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  balance: number;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string, balance?: number) => void;
  loadUser: () => Promise<void>;
  logout: () => void;
  updateBalance: (amount: number) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  balance: 0,
  isAuthenticated: !!localStorage.getItem('auth_token'),
  isLoading: !!localStorage.getItem('auth_token'),

  setAuth: (user, token, balance = 0) => {
    localStorage.setItem('auth_token', token);
    set({ user, token, balance, isAuthenticated: true, isLoading: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      set({ user: null, isAuthenticated: false, balance: 0, isLoading: false });
      return;
    }

    try {
      const data = await apiClient<{
        id: string;
        username: string;
        email?: string;
        chip_balance: number;
      }>('/auth/me', { method: 'GET' });

      set({
        user: { id: data.id, username: data.username, email: data.email },
        balance: data.chip_balance,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('auth_token');
      set({ user: null, token: null, balance: 0, isAuthenticated: false, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, balance: 0, isAuthenticated: false, isLoading: false });
  },

  updateBalance: (amount: number) =>
    set((state) => ({ balance: state.balance + amount })),
}));
