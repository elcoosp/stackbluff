import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Table {
  id: string;
  name: string;
  stake_level: string;
  max_players: number;
  current_players: number;
  status: 'waiting' | 'playing';
}

interface TableStore {
  tables: Table[];
  isLoading: boolean;
  lastFetched: number | null;
  setTables: (tables: Table[]) => void;
  setLoading: (loading: boolean) => void;
  refresh: () => Promise<void>;
}

export const useTableStore = create<TableStore>()(
  persist(
    (set, get) => ({
      tables: [],
      isLoading: false,
      lastFetched: null,
      setTables: (tables) => set({ tables, lastFetched: Date.now() }),
      setLoading: (loading) => set({ isLoading: loading }),
      refresh: async () => {
        const { setLoading, setTables } = get();
        setLoading(true);
        try {
          const response = await fetch('/api/lobby');
          if (!response.ok) throw new Error('Failed to fetch lobby');
          const data = await response.json();
          setTables(data.tables);
        } catch (error) {
          console.error('Lobby refresh failed:', error);
        } finally {
          setLoading(false);
        }
      },
    }),
    {
      name: 'table-storage',
      partialize: (state) => ({ tables: state.tables, lastFetched: state.lastFetched }),
    }
  )
);
