import { create } from "zustand";
interface ClubTheme { banner_url?: string | null; chip_preset_id?: number | null; felt_color?: string | null; }
interface State { themes: Record<string, ClubTheme>; setTheme: (id: string, t: ClubTheme) => void; }
export const useClubThemeStore = create<State>((set) => ({
  themes: {},
  setTheme: (id, t) => set((s) => ({ themes: { ...s.themes, [id]: t } })),
}));
