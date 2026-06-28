import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LeaderboardResponseSchema } from '../../lib/schemas';
import { apiRequest, handleApiError } from '../../lib/errorHandler';
import { logger } from '../../lib/logger';
import { LeaderboardSkeleton } from './LoadingSkeletons';
import { API } from '../../lib/constants';

interface ClubLeaderboardTabProps {
  clubId: string;
}

export function ClubLeaderboardTab({ clubId }: ClubLeaderboardTabProps) {
  const [currentDivision, setCurrentDivision] = useState(1);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['club-leaderboard', clubId, currentDivision],
    queryFn: async () => {
      const rawData = await apiRequest<unknown>(
        `/clubs/${clubId}/leaderboard?division=${currentDivision}`,
        {},
        { clubId, division: currentDivision }
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
        <p className="text-red-400 mb-4">Failed to load leaderboard</p>
        <button
          onClick={() => refetch()}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60">No tournament results yet.</p>
        <p className="text-white/40 text-sm mt-2">
          Once tournaments are completed, the leaderboard will appear here.
        </p>
      </div>
    );
  }

  const { entries, total_members, total_divisions } = data;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Club Leaderboard</h2>
          <p className="text-white/60 text-sm">
            {total_members} total members • Division {currentDivision} of {total_divisions}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg text-white text-sm transition-colors"
        >
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.user_id}
            className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <div className="flex-shrink-0 w-12 text-center">
              <span
                className={`text-2xl font-bold ${
                  entry.rank === 1
                    ? 'text-yellow-400'
                    : entry.rank === 2
                    ? 'text-gray-300'
                    : entry.rank === 3
                    ? 'text-orange-400'
                    : 'text-white/60'
                }`}
              >
                #{entry.rank}
              </span>
            </div>

            <div className="flex-shrink-0">
              {entry.avatar_url ? (
                <img
                  src={entry.avatar_url}
                  alt={entry.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                  {entry.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-grow">
              <p className="text-white font-medium">{entry.username}</p>
            </div>

            <div className="flex-shrink-0 text-right">
              <p className="text-white font-semibold">{entry.weekly_xp.toLocaleString()}</p>
              <p className="text-white/40 text-xs">XP this week</p>
            </div>
          </div>
        ))}
      </div>

      {total_divisions > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setCurrentDivision((d) => Math.max(1, d - 1))}
            disabled={currentDivision === 1}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
          >
            ← Previous
          </button>
          <span className="text-white/60">
            Division {currentDivision} of {total_divisions}
          </span>
          <button
            onClick={() => setCurrentDivision((d) => Math.min(total_divisions, d + 1))}
            disabled={currentDivision === total_divisions}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
