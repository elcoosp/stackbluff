import { apiClient } from '@stackbluff/shared/src/api/client';
import { getPlatformSurface } from '@stackbluff/shared/src/platform/surface';
import { create } from 'zustand';

/**
 * Mobile auth store (Task 3-b).
 *
 * Mirrors the shared `authStore` API surface (setAuth / loadUser / logout /
 * updateBalance) but replaces the module-scope `localStorage` reads — which
 * do not exist in React Native — with async reads through the configured
 * platform surface token storage (AsyncStorage, wired at boot). The shared
 * store cannot be imported on native without crashing at module init.
 */

export interface MobileAuthUser {
  id: string;
  username: string;
  email?: string;
  email_verified_at?: string | null;
  platform?: string;
  club_pro_expires_at?: string | null;
}

interface MeResponse {
  id: string;
  username: string;
  email?: string;
  email_verified_at?: string | null;
  platform?: string;
  club_pro_expires_at?: string | null;
  chip_balance: number;
}

interface AuthState {
  user: MobileAuthUser | null;
  token: string | null;
  balance: number;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True once the async token hydration finished (guards redirect flicker). */
  hydrated: boolean;
  /** Read the token from storage and sync isAuthenticated (boot only). */
  hydrate: () => Promise<void>;
  setAuth: (user: MobileAuthUser, token: string, balance?: number) => void;
  setBalance: (balance: number) => void;
  loadUser: () => Promise<void>;
  logout: () => void;
  updateBalance: (amount: number) => void;
}

async function readToken(): Promise<string | null> {
  try {
    return await getPlatformSurface().tokenStorage.get();
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  balance: 0,
  isAuthenticated: false,
  isLoading: true,
  hydrated: false,

  hydrate: async () => {
    const token = await readToken();
    set({
      token,
      isAuthenticated: !!token,
      isLoading: !!token,
      hydrated: true,
    });
  },

  setAuth: (user, token, balance = 0) => {
    void getPlatformSurface().tokenStorage.set(token);
    set({ user, token, balance, isAuthenticated: true, isLoading: false, hydrated: true });
  },

  setBalance: (balance) => set({ balance }),

  loadUser: async () => {
    const token = await readToken();
    if (!token) {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        balance: 0,
        isLoading: false,
        hydrated: true,
      });
      return;
    }
    try {
      const data = await apiClient<MeResponse>('/auth/me', { method: 'GET' });
      set({
        user: {
          id: data.id,
          username: data.username,
          email: data.email,
          email_verified_at: data.email_verified_at || null,
          platform: data.platform || 'mobile',
          club_pro_expires_at: data.club_pro_expires_at || null,
        },
        token,
        balance: data.chip_balance,
        isAuthenticated: true,
        isLoading: false,
        hydrated: true,
      });
    } catch (error) {
      console.warn('[authStore] Failed to load user:', error);
      await getPlatformSurface().tokenStorage.set(null);
      set({
        user: null,
        token: null,
        balance: 0,
        isAuthenticated: false,
        isLoading: false,
        hydrated: true,
      });
    }
  },

  logout: () => {
    void getPlatformSurface().tokenStorage.set(null);
    set({
      user: null,
      token: null,
      balance: 0,
      isAuthenticated: false,
      isLoading: false,
      hydrated: true,
    });
  },

  updateBalance: (amount) => set((state) => ({ balance: state.balance + amount })),
}));
