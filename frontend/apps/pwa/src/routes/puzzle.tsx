import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared/api/client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Brain, CheckCircle, XCircle, Sparkles, ArrowRight } from 'lucide-react';

interface Puzzle {
  id: number;
  hole_cards: string[];
  community_cards: string[];
  action_description: string;
  possible_actions: string[];
}

interface PuzzleResponse {
  puzzle_id: number;
  hole_cards: string[];
  community_cards: string[];
  action_description: string;
  possible_actions: string[];
}

interface SubmitResponse {
  correct: boolean;
  explanation: string;
  user_action: string;
  correct_action: string;
}

const cardRankMap: Record<string, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', '10': '10',
  'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A'
};
const suitMap: Record<string, string> = {
  'h': '♥', 'd': '♦', 'c': '♣', 's': '♠'
};

function formatCard(card: string): { rank: string; suit: string; display: string } {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1).toLowerCase();
  const rankDisplay = cardRankMap[rank] || rank;
  const suitDisplay = suitMap[suit] || suit;
  return { rank: rankDisplay, suit: suitDisplay, display: `${rankDisplay}${suitDisplay}` };
}

function CardDisplay({ card }: { card: string }) {
  const { rank, suit, display } = formatCard(card);
  const isRed = suit === '♥' || suit === '♦';
  return (
    <div className="w-12 h-16 bg-white rounded-md shadow-md flex flex-col items-center justify-center border border-gray-300">
      <span className={cn('text-sm font-bold', isRed ? 'text-red-600' : 'text-black')}>{rank}</span>
      <span className={cn('text-lg', isRed ? 'text-red-600' : 'text-black')}>{suit}</span>
    </div>
  );
}

export const Route = createFileRoute('/puzzle')({
  component: PuzzlePage,
});

function PuzzlePage() {
  const queryClient = useQueryClient();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { data: puzzle, isLoading, error, refetch } = useQuery<PuzzleResponse>({
    queryKey: ['puzzle', 'today'],
    queryFn: () => apiClient<PuzzleResponse>('/puzzle/today'),
    staleTime: 60_000,
    retry: 1,
  });

  const submitMutation = useMutation({
    mutationFn: (action: string) =>
      apiClient<SubmitResponse>('/puzzle/submit', {
        method: 'POST',
        body: JSON.stringify({ selected_action: action }),
      }),
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.correct) {
        toast.success('Correct! 🎉');
      } else {
        toast.error('Not quite. Try again tomorrow!');
      }
      queryClient.invalidateQueries({ queryKey: ['puzzle', 'today'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Submission failed');
    },
  });

  const handleSubmit = () => {
    if (selectedAction) {
      submitMutation.mutate(selectedAction);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <Brain className="w-8 h-8 text-tertiary" />
          <h1 className="font-display-lg text-3xl text-on-surface">Puzzle of the Day</h1>
        </div>
        <Skeleton className="h-40 bg-white/5 rounded-xl" />
        <Skeleton className="h-20 bg-white/5 rounded-xl" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-12 bg-white/5 rounded-lg" />
          <Skeleton className="h-12 bg-white/5 rounded-lg" />
          <Skeleton className="h-12 bg-white/5 rounded-lg" />
          <Skeleton className="h-12 bg-white/5 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="font-display-lg text-3xl text-on-surface">Puzzle of the Day</h1>
        <p className="text-red-400 mt-4">Failed to load puzzle. Please try again later.</p>
        <Button onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="font-display-lg text-3xl text-on-surface">Puzzle of the Day</h1>
        <p className="text-on-surface-variant mt-4">No puzzle available today. Check back tomorrow!</p>
      </div>
    );
  }

  const isCorrect = submitted && submitMutation.data?.correct;
  const isWrong = submitted && !submitMutation.data?.correct;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-8 h-8 text-tertiary" />
        <h1 className="font-display-lg text-3xl text-on-surface">Puzzle of the Day</h1>
        <Badge variant="outline" className="ml-auto text-xs border-tertiary/30 text-tertiary">
          Daily
        </Badge>
      </div>

      <Card className="p-6 bg-white/5 border-white/10">
        <p className="text-on-surface-variant text-sm mb-4">{puzzle.action_description}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {puzzle.hole_cards.map((card, idx) => (
            <CardDisplay key={idx} card={card} />
          ))}
          <span className="text-on-surface-variant text-sm self-center">|</span>
          {puzzle.community_cards.map((card, idx) => (
            <CardDisplay key={idx} card={card} />
          ))}
        </div>
      </Card>

      {!submitted ? (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-on-surface-variant">Select your action:</p>
            <div className="grid grid-cols-2 gap-2">
              {puzzle.possible_actions.map((action) => (
                <button
                  key={action}
                  onClick={() => setSelectedAction(action)}
                  className={cn(
                    'p-3 rounded-lg border transition-all text-sm font-medium',
                    selectedAction === action
                      ? 'border-tertiary bg-tertiary/10 text-tertiary'
                      : 'border-white/10 hover:border-white/30 text-on-surface-variant'
                  )}
                >
                  {action.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!selectedAction || submitMutation.isPending}
            className="w-full bg-tertiary text-on-tertiary hover:bg-tertiary/80"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Answer'}
          </Button>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl border bg-white/5"
        >
          <div className="flex items-center gap-3 mb-3">
            {isCorrect ? (
              <CheckCircle className="w-6 h-6 text-tertiary" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400" />
            )}
            <span className={cn('text-lg font-semibold', isCorrect ? 'text-tertiary' : 'text-red-400')}>
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant">{submitMutation.data?.explanation}</p>
          <p className="text-sm text-on-surface-variant mt-2">
            Your action: <span className="font-mono text-tertiary">{submitMutation.data?.user_action?.toUpperCase()}</span>
          </p>
          <p className="text-sm text-on-surface-variant">
            Correct action: <span className="font-mono text-tertiary">{submitMutation.data?.correct_action?.toUpperCase()}</span>
          </p>
          <Button
            variant="outline"
            className="mt-4 border-white/10 text-on-surface-variant hover:text-on-surface"
            onClick={() => {
              setSubmitted(false);
              setSelectedAction(null);
              refetch();
            }}
          >
            Try Another <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}
