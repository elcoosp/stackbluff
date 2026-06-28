import { useEffect, useState, useCallback } from 'react';
import { getTodayPuzzle, submitPuzzle, PuzzleResponse } from '../../services/api';
import { usePuzzleStore } from '../../stores/puzzleStore';
import { PlatformAPI } from '../../platform/PlatformAPI';
import { formatShareText } from '../../utils/shareUtils';

export function PuzzleCard() {
    const [puzzle, setPuzzle] = useState<PuzzleResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { hasSubmittedToday, todaysResult, setSubmission, resetIfNewDay } = usePuzzleStore();

    useEffect(() => { resetIfNewDay(); getTodayPuzzle().then(setPuzzle).catch(e => setError(e.message)).finally(() => setLoading(false)); }, [resetIfNewDay]);

    const handleAction = useCallback(async (action: string) => {
        if (!puzzle || submitting || hasSubmittedToday) return;
        setSubmitting(true); setError(null);
        try { setSubmission(await submitPuzzle(action)); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setSubmitting(false); }
    }, [puzzle, submitting, hasSubmittedToday, setSubmission]);

    const handleShare = useCallback(async () => {
        if (!todaysResult) return;
        try { await PlatformAPI.shareContent({ title: 'Daily Poker Puzzle', text: formatShareText(todaysResult), url: window.location.origin }); } catch (e) { console.error(e); }
    }, [todaysResult]);

    if (loading) return <div className="p-4 text-center">Loading...</div>;
    if (error && !puzzle) return <div className="p-4 text-red-500 text-center">{error}</div>;
    if (!puzzle) return null;

    return (
        <div className="puzzle-card bg-white rounded-xl shadow-lg p-6 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-center">🃏 Daily Poker Puzzle</h2>
            <div className="mb-4"><div className="text-sm text-gray-600 mb-1">Your Hand:</div><div className="flex gap-2 justify-center">{puzzle.hole_cards.map((c, i) => <span key={i} className="bg-blue-100 rounded px-2 py-1 font-mono border">{c}</span>)}</div></div>
            {puzzle.community_cards.length > 0 && <div className="mb-4"><div className="text-sm text-gray-600 mb-1">Community:</div><div className="flex gap-2 justify-center">{puzzle.community_cards.map((c, i) => <span key={i} className="bg-green-100 rounded px-2 py-1 font-mono border">{c}</span>)}</div></div>}
            <div className="mb-6 p-4 bg-gray-50 rounded text-center"><p>{puzzle.action_description}</p></div>
            {!todaysResult ? (
                <div className="grid grid-cols-2 gap-3">
                    {puzzle.possible_actions.map(a => <button key={a} onClick={() => handleAction(a)} disabled={submitting} className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50">{submitting ? '...' : a.toUpperCase()}</button>)}
                </div>
            ) : (
                <div className="text-center space-y-4">
                    <div className={`p-4 rounded ${todaysResult.correct ? 'bg-green-100' : 'bg-red-100'}`}>
                        <div className="text-2xl">{todaysResult.correct ? '✅ Correct!' : '❌ Incorrect'}</div>
                        <div>You chose: <b>{todaysResult.user_action.toUpperCase()}</b></div>
                        {!todaysResult.correct && <div>Correct: <b>{todaysResult.correct_action.toUpperCase()}</b></div>}
                    </div>
                    <div className="p-3 bg-gray-50 rounded text-sm"><b>Explanation:</b> {todaysResult.explanation}</div>
                    <button onClick={handleShare} className="w-full px-4 py-2 bg-purple-500 text-white rounded">📤 Share My Answer</button>
                </div>
            )}
        </div>
    );
}
