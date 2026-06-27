export interface PuzzleResponse { puzzle_id: number; hole_cards: string[]; community_cards: string[]; action_description: string; possible_actions: string[]; }
export interface SubmitResponse { correct: boolean; explanation: string; user_action: string; correct_action: string; }

export const getTodayPuzzle = async (): Promise<PuzzleResponse> => {
    const res = await fetch('/api/puzzle/today');
    if (!res.ok) throw new Error('Failed to fetch puzzle');
    return res.json();
};

export const submitPuzzle = async (selectedAction: string): Promise<SubmitResponse> => {
    const res = await fetch('/api/puzzle/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_action: selectedAction }),
    });
    if (!res.ok) {
        if (res.status === 409) { const data = await res.json(); throw new Error(`Already submitted: ${data.selected_action}`); }
        throw new Error('Failed to submit puzzle');
    }
    return res.json();
};
