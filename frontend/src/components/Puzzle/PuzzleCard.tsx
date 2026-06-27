import { useEffect, useState } from 'react';
import { getTodayPuzzle, submitPuzzle, PuzzleResponse, SubmitResponse } from '../../services/api';

interface PuzzleCardProps {
    onShare?: (result: SubmitResponse) => void;
}

export function PuzzleCard({ onShare }: PuzzleCardProps) {
    const [puzzle, setPuzzle] = useState<PuzzleResponse | null>(null);
    const [result, setResult] = useState<SubmitResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPuzzle = async () => {
            try {
                const data = await getTodayPuzzle();
                setPuzzle(data);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load puzzle');
            } finally {
                setLoading(false);
            }
        };
        fetchPuzzle();
    }, []);

    const handleAction = async (action: string) => {
        if (!puzzle || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await submitPuzzle(action);
            setResult(res);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to submit');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center">Loading puzzle...</div>;
    }

    if (error && !puzzle) {
        return <div className="p-4 text-red-500 text-center">{error}</div>;
    }

    if (!puzzle) return null;

    return (
        <div className="puzzle-card bg-white rounded-xl shadow-lg p-6 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-center">🃏 Daily Poker Puzzle</h2>

            {/* Cards Display */}
            <div className="mb-4">
                <div className="text-sm text-gray-600 mb-1">Your Hand:</div>
                <div className="flex gap-2 justify-center">
                    {puzzle.hole_cards.map((card, i) => (
                        <span key={i} className="playing-card bg-blue-100 rounded-lg px-3 py-2 font-mono font-bold text-lg border-2 border-blue-300">
                            {card}
                        </span>
                    ))}
                </div>
            </div>

            {puzzle.community_cards.length > 0 && (
                <div className="mb-4">
                    <div className="text-sm text-gray-600 mb-1">Community:</div>
                    <div className="flex gap-2 justify-center flex-wrap">
                        {puzzle.community_cards.map((card, i) => (
                            <span key={i} className="playing-card bg-green-100 rounded-lg px-3 py-2 font-mono font-bold text-lg border-2 border-green-300">
                                {card}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Description */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-gray-800">{puzzle.action_description}</p>
            </div>

            {/* Action Buttons or Result */}
            {!result ? (
                <div className="grid grid-cols-2 gap-3">
                    {puzzle.possible_actions.map((action) => (
                        <button
                            key={action}
                            onClick={() => handleAction(action)}
                            disabled={submitting}
                            className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                                action === 'fold' ? 'bg-red-500 hover:bg-red-600 text-white' :
                                action === 'call' || action === 'check' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                                action === 'raise' ? 'bg-green-500 hover:bg-green-600 text-white' :
                                'bg-yellow-500 hover:bg-yellow-600 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {submitting ? '...' : action.toUpperCase()}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="text-center space-y-4">
                    <div className={`p-4 rounded-lg ${result.correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        <div className="text-2xl mb-2">
                            {result.correct ? '✅ Correct!' : '❌ Incorrect'}
                        </div>
                        <div className="font-medium">
                            You chose: <span className="uppercase font-bold">{result.user_action}</span>
                        </div>
                        {!result.correct && (
                            <div className="font-medium mt-1">
                                Correct action: <span className="uppercase font-bold">{result.correct_action}</span>
                            </div>
                        )}
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-gray-700 text-sm">
                        <strong>Explanation:</strong> {result.explanation}
                    </div>
                    {onShare && (
                        <button
                            onClick={() => onShare(result)}
                            className="w-full px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold transition-all"
                        >
                            📤 Share My Answer
                        </button>
                    )}
                </div>
            )}

            {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-center text-sm">
                    {error}
                </div>
            )}
        </div>
    );
}
