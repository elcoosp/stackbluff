import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@stackbluff/shared/ui/Card';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  weekly_xp: number;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total_members: number;
  total_divisions: number;
  current_division: number;
}

interface ClubLeaderboardTabProps {
  clubId: string;
}

const MEMBERS_PER_DIVISION = 500;

export function ClubLeaderboardTab({ clubId }: ClubLeaderboardTabProps) {
  const [currentDivision, setCurrentDivision] = useState(1);

  // Fetch leaderboard data with React Query
  const { data, isLoading, error, refetch } = useQuery<LeaderboardResponse>({
    queryKey: ['club-leaderboard', clubId, currentDivision],
    queryFn: async () => {
      const response = await fetch(
        `/api/clubs/${clubId}/leaderboard?division=${currentDivision}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
      }
      return response.json();
    },
    // Auto-refresh every 5 minutes (300000ms)
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000, // Consider stale after 1 minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Loading leaderboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
        <p className="text-white/60">
          {error instanceof Error ? error.message : 'Failed to load leaderboard'}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
        >
          Retry
        </button>
      </Card>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60">No leaderboard data available yet.</p>
        <p className="text-white/40 text-sm mt-2">
          Play some games to see the leaderboard!
        </p>
      </div>
    );
  }

  const { entries, total_members, total_divisions } = data;

  return (
    <div>
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Club Leaderboard</h2>
          <p className="text-white/60 text-sm">
            {total_members} total members • Division {currentDivision} of{' '}
            {total_divisions}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Leaderboard table */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.user_id}
            className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            {/* Rank */}
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

            {/* Avatar */}
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

            {/* Username */}
            <div className="flex-grow">
              <p className="text-white font-medium">{entry.username}</p>
            </div>

            {/* Weekly XP */}
            <div className="flex-shrink-0 text-right">
              <p className="text-white font-semibold">
                {entry.weekly_xp.toLocaleString()}
              </p>
              <p className="text-white/40 text-xs">XP this week</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination controls */}
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
            onClick={() =>
              setCurrentDivision((d) => Math.min(total_divisions, d + 1))
            }
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
