import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchLobby, type Table } from '../lib/api';

const MAX_CACHED_TABLES = 50;

interface TableStore {
  tables: Table[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  abortController: AbortController | null;
  setTables: (tables: Table[]) => void;
  setError: (error: string | null) => void;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export const useTableStore = create<TableStore>()(
  persist(
    (set, get) => ({
      tables: [],
      isLoading: false,
      error: null,
      lastFetched: null,
      abortController: null,

      setTables: (tables) => {
        if (tables.length > MAX_CACHED_TABLES) {
          console.warn(`[TableStore] Truncating ${tables.length} tables to ${MAX_CACHED_TABLES}`);
        }
        set({
          tables: tables.slice(0, MAX_CACHED_TABLES),
          lastFetched: Date.now(),
          error: null,
        });
      },
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      refresh: async () => {
        const { abortController, setTables, setError } = get();
        if (abortController) {
          abortController.abort();
        }
        const newController = new AbortController();
        set({ abortController: newController, isLoading: true, error: null });

        try {
          const data = await fetchLobby(newController.signal);
          if (!newController.signal.aborted) {
            setTables(data.tables);
          }
        } catch (err) {
          if (!newController.signal.aborted) {
            const message = err instanceof Error ? err.message : 'Failed to load lobby';
            setError(message);
            console.error('[TableStore] refresh error:', err);
          }
        } finally {
          if (!newController.signal.aborted) {
            set({ isLoading: false, abortController: null });
          }
        }
      },
    }),
    {
      name: 'table-storage',
      partialize: (state) => ({
        tables: state.tables,
        lastFetched: state.lastFetched,
      }),
    },
  ),
);
