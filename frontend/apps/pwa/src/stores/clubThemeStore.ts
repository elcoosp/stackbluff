import { create } from 'zustand';

interface ClubTheme {
  banner_url?: string | null;
  chip_preset_id?: number | null;
  felt_color?: string | null;
}

interface ClubThemeState {
  themes: Record<string, ClubTheme>;
  setTheme: (clubId: string, theme: ClubTheme) => void;
  getTheme: (clubId: string) => ClubTheme | undefined;
  clearTheme: (clubId: string) => void;
}

export const useClubThemeStore = create<ClubThemeState>((set, get) => ({
  themes: {},
  setTheme: (clubId, theme) =>
    set((state) => ({
      themes: {
        ...state.themes,
        [clubId]: {
          ...state.themes[clubId],
          ...theme,
        },
      },
    })),
  getTheme: (clubId) => get().themes[clubId],
  clearTheme: (clubId) =>
    set((state) => {
      const newThemes = { ...state.themes };
      delete newThemes[clubId];
      return { themes: newThemes };
    }),
}));
