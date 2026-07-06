import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SubmitResponse } from '../services/api';

const getUTCDate = () => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

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
            hasSubmittedToday: false, todaysResult: null, lastSubmissionDate: null,
            setSubmission: (result) => set({ hasSubmittedToday: true, todaysResult: result, lastSubmissionDate: getUTCDate() }),
            resetIfNewDay: () => { if (get().lastSubmissionDate !== getUTCDate()) set({ hasSubmittedToday: false, todaysResult: null, lastSubmissionDate: null }); },
        }),
        { name: 'puzzle-storage' }
    )
);
