import { create } from 'zustand';

interface DealState {
  isDealing: boolean;
  dealGeneration: number;
  startDealing: () => void;
  finishDealing: () => void;
}

export const useDealStore = create<DealState>((set) => ({
  isDealing: false,
  dealGeneration: 0,
  startDealing: () =>
    set((state) => ({
      isDealing: true,
      dealGeneration: state.dealGeneration + 1,
    })),
  finishDealing: () => set({ isDealing: false }),
}));
