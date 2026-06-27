import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SubmitResponse } from '../services/api';

interface PuzzleState {
    hasSubmittedToday: boolean;
    todaysResult: SubmitResponse | null;
    lastSubmissionDate: string | null;
    setSubmission: (result: SubmitResponse) => void;
    resetIfNewDay: () => void;
}

export const usePuzzleStore = create<PuzzleState>()(
    persist(
        (set, get) => ({
            hasSubmittedToday: false,
            todaysResult: null,
            lastSubmissionDate: null,
            setSubmission: (result) => {
                const today = new Date().toISOString().split('T')[0];
                set({ hasSubmittedToday: true, todaysResult: result, lastSubmissionDate: today });
            },
            resetIfNewDay: () => {
                const today = new Date().toISOString().split('T')[0];
                if (get().lastSubmissionDate !== today) {
                    set({ hasSubmittedToday: false, todaysResult: null, lastSubmissionDate: null });
                }
            },
        }),
        { name: 'puzzle-storage' }
    )
);
