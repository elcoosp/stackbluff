import { Trans } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { API } from '../../lib/constants';
import { apiRequest, handleApiError } from '../../lib/errorHandler';
import { logger } from '../../lib/logger';
import { LeaderboardResponseSchema } from '../../lib/schemas';
import { LeaderboardSkeleton } from './LoadingSkeletons';

interface ClubLeaderboardTabProps {
  clubId: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
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

export function ClubLeaderboardTab({ clubId }: ClubLeaderboardTabProps) {
  const [currentDivision, setCurrentDivision] = useState(1);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['club-leaderboard', clubId, currentDivision],
    queryFn: async () => {
      const rawData = await apiRequest<unknown>(
        `/clubs/${clubId}/leaderboard?division=${currentDivision}`,
        {},
        { clubId, division: currentDivision },
      );
      return LeaderboardResponseSchema.parse(rawData);
    },
    refetchInterval: API.STALE_TIME_LONG,
    staleTime: API.STALE_TIME_MEDIUM,
    retry: API.DEFAULT_RETRY_COUNT,
  });

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (error) {
    logger.error('Failed to load leaderboard', error instanceof Error ? error : undefined, {
      clubId,
      division: currentDivision,
    });
    handleApiError(error, { clubId, division: currentDivision });

    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">
          <Trans>Failed to load leaderboard</Trans>
        </p>
        <Button
          onClick={() => refetch()}
          className="bg-tertiary text-on-tertiary hover:bg-tertiary/80 rounded-xl"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> <Trans>Retry</Trans>
        </Button>
      </div>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-on-surface-variant">
          <Trans>No tournament results yet.</Trans>
        </p>
        <p className="text-on-surface-variant/60 text-sm mt-2">
          <Trans>Once tournaments are completed, the leaderboard will appear here.</Trans>
        </p>
      </div>
    );
  }

  const { entries, total_members, total_divisions } = data;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-data-mono uppercase tracking-widest text-yellow-400">
              <Trans>Rankings</Trans>
            </span>
          </div>
          <h2 className="font-headline-md text-xl text-on-surface">
            <Trans>Club Leaderboard</Trans>
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            <Trans>
              {total_members} total members • Division {currentDivision} of {total_divisions}
            </Trans>
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isFetching}
          variant="outline"
          className="border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-label-caps text-xs uppercase tracking-wider rounded-xl w-full sm:w-auto justify-center"
        >
          <RotateCcw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />
          {isFetching ? <Trans>Refreshing</Trans> : <Trans>Refresh</Trans>}
        </Button>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        {entries.map((entry) => (
          <motion.div
            key={entry.user_id}
            variants={itemVariants}
            className={cn(
              'flex items-center gap-4 p-4 rounded-xl border transition-colors',
              entry.rank === 1
                ? 'bg-yellow-500/5 border-yellow-500/20'
                : 'bg-white/5 border-white/10 hover:bg-white/[0.07]',
            )}
          >
            <div className="flex-shrink-0 w-10 text-center">
              <span
                className={cn(
                  'text-lg font-bold',
                  entry.rank === 1
                    ? 'text-yellow-400'
                    : entry.rank === 2
                      ? 'text-gray-300'
                      : entry.rank === 3
                        ? 'text-orange-400'
                        : 'text-on-surface-variant',
                )}
              >
                #{entry.rank}
              </span>
            </div>

            <div className="flex-shrink-0">
              {entry.avatar_url ? (
                <img
                  src={entry.avatar_url}
                  alt={entry.username}
                  className="w-12 h-12 rounded-full object-cover border border-white/10"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center text-white font-bold text-lg border border-white/10">
                  {entry.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-grow">
              <p className="font-headline-md text-sm text-on-surface">{entry.username}</p>
            </div>

            <div className="flex-shrink-0 text-right">
              <p className="font-headline-md text-sm text-on-surface">
                {entry.weekly_xp.toLocaleString()}
              </p>
              <p className="text-on-surface-variant text-xs">
                <Trans>XP this week</Trans>
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {total_divisions > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button
            onClick={() => setCurrentDivision((d) => Math.max(1, d - 1))}
            disabled={currentDivision === 1}
            variant="outline"
            className="border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-label-caps text-xs uppercase tracking-wider rounded-xl disabled:opacity-40 px-4 py-2"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> <Trans>Prev</Trans>
          </Button>
          <span className="text-sm font-data-mono text-on-surface-variant">
            <Trans>
              Division {currentDivision} / {total_divisions}
            </Trans>
          </span>
          <Button
            onClick={() => setCurrentDivision((d) => Math.min(total_divisions, d + 1))}
            disabled={currentDivision === total_divisions}
            variant="outline"
            className="border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-label-caps text-xs uppercase tracking-wider rounded-xl disabled:opacity-40 px-4 py-2"
          >
            <Trans>Next</Trans> <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
