import { create } from 'zustand';
import { getPlatform, type PlatformUser } from '../platform';

interface UserState {
  user: PlatformUser | null;
  loading: boolean;
  loadUser: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  loading: false,
  loadUser: async () => {
    set({ loading: true });
    try {
      const platform = getPlatform();
      const user = await platform.getUser();
      set({ user, loading: false });
    } catch (error) {
      console.error('Failed to load user', error);
      set({ loading: false });
    }
  },
}));
