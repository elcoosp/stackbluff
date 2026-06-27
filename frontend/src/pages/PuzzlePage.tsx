import { PuzzleCard } from '../components/Puzzle/PuzzleCard';
import { SubmitResponse } from '../services/api';

export function PuzzlePage() {
    const handleShare = async (result: SubmitResponse) => {
        const shareText = `🃏 Daily Poker Puzzle\n\n` +
            `I chose: ${result.user_action.toUpperCase()}\n` +
            `Correct action: ${result.correct_action.toUpperCase()}\n\n` +
            `${result.explanation}\n\n` +
            `Can you beat me? Play here: ${window.location.origin}`;

        try {
            // Use PlatformAPI if available
            if (window.navigator.share) {
                await window.navigator.share({
                    title: 'Daily Poker Puzzle',
                    text: shareText,
                });
            } else {
                await navigator.clipboard.writeText(shareText);
                alert('Share text copied to clipboard!');
            }
        } catch (e) {
            console.error('Share failed:', e);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8">
            <PuzzleCard onShare={handleShare} />
        </div>
    );
}
