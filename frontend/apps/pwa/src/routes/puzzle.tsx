import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { apiClient } from '@stackbluff/shared/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Brain,
  Crown,
  Layers,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};
const suitMap: Record<string, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

function formatCard(card: string): { rank: string; suit: string; display: string } {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1).toLowerCase();
  const rankDisplay = cardRankMap[rank] || rank;
  const suitDisplay = suitMap[suit] || suit;
  return { rank: rankDisplay, suit: suitDisplay, display: `${rankDisplay}${suitDisplay}` };
}

function CardDisplay({ card, index = 0 }: { card: string; index?: number }) {
  const { rank, suit } = formatCard(card);
  const isRed = suit === '♥' || suit === '♦';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, rotateY: -20 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, scale: 1.04 }}
      className="w-14 h-20 bg-gradient-to-br from-white to-gray-100 rounded-xl shadow-lg flex flex-col items-center justify-center border border-gray-300/60 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
      <span
        className={cn('text-sm font-bold relative z-10', isRed ? 'text-red-600' : 'text-gray-900')}
      >
        {rank}
      </span>
      <span className={cn('text-2xl relative z-10', isRed ? 'text-red-600' : 'text-gray-900')}>
        {suit}
      </span>
    </motion.div>
  );
}

export const Route = createFileRoute('/puzzle')({
  component: PuzzlePage,
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function PuzzlePage() {
  const queryClient = useQueryClient();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    data: puzzle,
    isLoading,
    error,
    refetch,
  } = useQuery<PuzzleResponse>({
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
        toast.success(t`Correct! 🎉`);
      } else {
        toast.error(t`Not quite. Try again tomorrow!`);
      }
      queryClient.invalidateQueries({ queryKey: ['puzzle', 'today'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t`Submission failed`);
    },
  });

  const handleSubmit = () => {
    if (selectedAction) {
      submitMutation.mutate(selectedAction);
    }
  };

  if (isLoading) {
    return (
      <div className="relative max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-tertiary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 bg-white/5" />
          <Skeleton className="h-10 w-64 bg-white/5" />
          <Skeleton className="h-4 w-80 bg-white/5" />
        </div>
        <Skeleton className="h-48 bg-white/5 rounded-2xl" />
        <Skeleton className="h-24 bg-white/5 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-14 bg-white/5 rounded-xl" />
          <Skeleton className="h-14 bg-white/5 rounded-xl" />
          <Skeleton className="h-14 bg-white/5 rounded-xl" />
          <Skeleton className="h-14 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative max-w-4xl mx-auto p-4 md:p-8">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="font-display-lg text-3xl text-on-surface mb-2">
            <Trans>Failed to Load</Trans>
          </h1>
          <p className="text-on-surface-variant text-sm mb-6">
            <Trans>We couldn't load today's puzzle. Please try again.</Trans>
          </p>
          <Button
            onClick={() => refetch()}
            className="bg-tertiary text-on-tertiary hover:bg-tertiary/80"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> <Trans>Retry</Trans>
          </Button>
        </motion.div>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="relative max-w-4xl mx-auto p-4 md:p-8">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-on-surface-variant" />
          </div>
          <h1 className="font-display-lg text-3xl text-on-surface mb-2">
            <Trans>No Puzzle Today</Trans>
          </h1>
          <p className="text-on-surface-variant text-sm">
            <Trans>Check back tomorrow for a fresh challenge!</Trans>
          </p>
        </motion.div>
      </div>
    );
  }

  const isCorrect = submitted && submitMutation.data?.correct;
  const _isWrong = submitted && !submitMutation.data?.correct;

  return (
    <div className="relative max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-tertiary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-tertiary" />
          <span className="text-xs font-data-mono uppercase tracking-widest text-tertiary">
            <Trans>Daily Challenge</Trans>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface">
            <Trans>Puzzle of the Day</Trans>
          </h1>
          <Badge
            variant="outline"
            className="border-tertiary/30 text-tertiary bg-tertiary/10 font-data-mono"
          >
            <Crown className="w-3 h-3 mr-1" /> <Trans>Daily</Trans>
          </Badge>
        </div>
        <p className="text-on-surface-variant text-sm mt-1 max-w-md">
          <Trans>
            Analyze the scenario and pick the optimal action. Sharpen your instincts one hand at a
            time.
          </Trans>
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Scenario Card */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 md:p-8 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-tertiary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-5 relative">
              <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center border border-tertiary/20">
                <Lightbulb className="w-5 h-5 text-tertiary" />
              </div>
              <div>
                <span className="text-xs font-data-mono uppercase tracking-widest text-tertiary">
                  <Trans>Scenario</Trans>
                </span>
                <h2 className="font-headline-md text-base text-on-surface">
                  <Trans>Read the Situation</Trans>
                </h2>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-6 relative">
              {puzzle.action_description}
            </p>

            {/* Hole Cards */}
            <div className="space-y-4 relative">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-3.5 h-3.5 text-on-surface-variant" />
                  <span className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant">
                    <Trans>Hole Cards</Trans>
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {puzzle.hole_cards.map((card, idx) => (
                    <CardDisplay key={`hole-${idx}`} card={card} index={idx} />
                  ))}
                </div>
              </div>

              {puzzle.community_cards.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-3.5 h-3.5 text-on-surface-variant" />
                    <span className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant">
                      <Trans>Community Cards</Trans>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {puzzle.community_cards.map((card, idx) => (
                      <CardDisplay
                        key={`community-${idx}`}
                        card={card}
                        index={idx + puzzle.hole_cards.length}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Action Selection / Result */}
        {!submitted ? (
          <>
            <motion.div variants={itemVariants} className="space-y-3">
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-tertiary" />
                <span className="text-xs font-data-mono uppercase tracking-widest text-tertiary">
                  <Trans>Choose Your Move</Trans>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {puzzle.possible_actions.map((action, idx) => {
                  const isSelected = selectedAction === action;
                  return (
                    <motion.button
                      key={action}
                      variants={itemVariants}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedAction(action)}
                      className={cn(
                        'p-4 rounded-2xl border backdrop-blur-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden',
                        isSelected
                          ? 'border-tertiary bg-tertiary/10 text-tertiary shadow-lg shadow-tertiary/10'
                          : 'border-white/10 bg-white/5 text-on-surface-variant hover:bg-white/[0.07] hover:border-white/20',
                      )}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center font-data-mono text-xs border transition-colors',
                            isSelected
                              ? 'bg-tertiary/20 border-tertiary/40 text-tertiary'
                              : 'bg-white/5 border-white/10 text-on-surface-variant group-hover:text-on-surface',
                          )}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-headline-md tracking-wide">
                          {action.toUpperCase()}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Button
                onClick={handleSubmit}
                disabled={!selectedAction || submitMutation.isPending}
                className="w-full bg-tertiary text-on-tertiary hover:bg-tertiary/80 disabled:opacity-40 disabled:cursor-not-allowed h-12 rounded-2xl font-headline-md text-sm tracking-wide shadow-lg shadow-tertiary/20"
              >
                {submitMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 animate-spin" /> <Trans>Submitting...</Trans>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Trans>Submit Answer</Trans> <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </motion.div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card
              className={cn(
                'p-6 md:p-8 border backdrop-blur-xl rounded-2xl relative overflow-hidden',
                isCorrect
                  ? 'bg-gradient-to-br from-tertiary/10 to-emerald-500/5 border-tertiary/20'
                  : 'bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/20',
              )}
            >
              <div
                className={cn(
                  'absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none',
                  isCorrect ? 'bg-tertiary/10' : 'bg-red-500/10',
                )}
              />
              <div className="relative">
                <div className="flex items-center gap-4 mb-5">
                  <div
                    className={cn(
                      'w-14 h-14 rounded-full flex items-center justify-center border',
                      isCorrect
                        ? 'bg-tertiary/10 border-tertiary/30'
                        : 'bg-red-500/10 border-red-500/30',
                    )}
                  >
                    {isCorrect ? (
                      <Trophy className="w-7 h-7 text-tertiary" />
                    ) : (
                      <XCircle className="w-7 h-7 text-red-400" />
                    )}
                  </div>
                  <div>
                    <span
                      className={cn(
                        'text-xs font-data-mono uppercase tracking-widest',
                        isCorrect ? 'text-tertiary' : 'text-red-400',
                      )}
                    >
                      {isCorrect ? t`Nice Play` : t`Missed It`}
                    </span>
                    <h2
                      className={cn(
                        'font-display-lg text-2xl',
                        isCorrect ? 'text-tertiary' : 'text-red-400',
                      )}
                    >
                      {isCorrect ? t`Correct!` : t`Incorrect`}
                    </h2>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-3.5 h-3.5 text-tertiary" />
                    <span className="text-xs font-data-mono uppercase tracking-widest text-tertiary">
                      <Trans>Explanation</Trans>
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {submitMutation.data?.explanation}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant block mb-1">
                      <Trans>Your Action</Trans>
                    </span>
                    <span className="font-headline-md text-base text-on-surface font-mono">
                      {submitMutation.data?.user_action?.toUpperCase()}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'p-4 rounded-xl border',
                      isCorrect
                        ? 'bg-tertiary/5 border-tertiary/20'
                        : 'bg-tertiary/5 border-tertiary/20',
                    )}
                  >
                    <span className="text-xs font-data-mono uppercase tracking-widest text-tertiary block mb-1">
                      <Trans>Correct Action</Trans>
                    </span>
                    <span className="font-headline-md text-base text-tertiary font-mono">
                      {submitMutation.data?.correct_action?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full border-white/10 bg-white/5 text-on-surface hover:bg-white/10 hover:text-on-surface h-12 rounded-2xl font-headline-md text-sm"
                  onClick={() => {
                    setSubmitted(false);
                    setSelectedAction(null);
                    refetch();
                  }}
                >
                  <Trans>Try Another</Trans> <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
