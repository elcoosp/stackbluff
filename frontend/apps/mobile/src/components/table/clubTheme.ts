/**
 * Club skin store — native mirror of PWA `apps/pwa/src/stores/clubThemeStore.ts`.
 *
 * The PWA applies `felt_color` through the `data-club-felt` attribute +
 * external CSS; on native the TableScene reads the theme here and renders a
 * tint overlay above the felt gradient (see TableScene feltTint handling).
 * Club screens (A5) call `setTheme(clubId, { felt_color })` after fetching
 * club settings; the table route passes the active club id.
 */
import { create } from 'zustand';

export interface ClubTheme {
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

/** Selects the felt tint for a club table (`undefined` → default emerald). */
export function useClubFeltTint(clubId?: string | null): string | undefined {
  return useClubThemeStore((state) =>
    clubId ? (state.themes[clubId]?.felt_color ?? undefined) : undefined,
  );
}
