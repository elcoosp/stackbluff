import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Trophy, Medal, Users, Calendar, TrendingUp, Crown } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
});

type Period = 'global' | 'weekly' | 'monthly';

function LeaderboardPage() {
  const navigate = useNavigate();
  const { data: entries, isLoading, error } = useLeaderboard();
  const currentUser = useAuthStore((s) => s.user);
  const [period, setPeriod] = useState<Period>('global');

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full text-red-400">
        Failed to load leaderboard: {(error as Error).message}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex justify-center items-center h-full text-on-surface-variant">
        No leaderboard data available yet.
      </div>
    );
  }

  // For demo, we use the same entries for all periods
  // In production, we'd fetch different endpoints
  const displayEntries = entries;
  const topThree = displayEntries.slice(0, 3);
  const rest = displayEntries.slice(3);
  const userRank = displayEntries.findIndex((e) => e.user_id === currentUser?.id) + 1;

  const periodLabels: Record<Period, { label: string; icon: React.ReactNode }> = {
    global: { label: 'All Time', icon: <Trophy className="w-4 h-4" /> },
    weekly: { label: 'This Week', icon: <Calendar className="w-4 h-4" /> },
    monthly: { label: 'This Month', icon: <TrendingUp className="w-4 h-4" /> },
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display-lg text-3xl md:text-display-lg text-on-surface mb-2">
        Leaderboard
      </h1>
      <p className="text-on-surface-variant text-sm mb-6">Top players by total chips won.</p>

      {/* Period Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-8 w-fit">
        {(Object.keys(periodLabels) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              period === p
                ? 'bg-tertiary text-on-tertiary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/10'
            )}
          >
            {periodLabels[p].icon}
            {periodLabels[p].label}
          </button>
        ))}
      </div>

      {/* Podium */}
      <div className="flex justify-center items-end gap-4 mb-10">
        {topThree.map((entry, idx) => {
          const rank = idx + 1;
          const heights = ['h-32', 'h-48', 'h-24'];
          const colors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
          const medals = ['🥇', '🥈', '🥉'];
          const isCurrentUser = entry.user_id === currentUser?.id;
          return (
            <motion.div
              key={entry.user_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex flex-col items-center"
            >
              <div
                className={cn(
                  'w-20 rounded-t-xl flex flex-col items-center justify-end p-3 bg-white/5 border border-white/10 cursor-pointer hover:border-tertiary/40 transition-colors',
                  heights[idx],
                  isCurrentUser ? 'ring-2 ring-tertiary' : ''
                )}
                onClick={() => navigate({ to: '/players/$userId', params: { userId: entry.user_id } })}
              >
                <span className={cn('text-3xl', colors[idx])}>{medals[idx]}</span>
                <span className="text-xs font-mono text-on-surface-variant mt-1">#{rank}</span>
              </div>
              <span className="text-sm font-medium text-on-surface mt-1 truncate max-w-[80px]">
                {entry.display_name}
              </span>
              <span className="text-xs font-mono text-tertiary">
                ${entry.total_chips_won.toLocaleString()}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Full list */}
      <div className="bg-surface-container-lowest/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden razor-highlight">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/10">
              <tr>
                <th className="text-left py-3 px-4 font-label-caps text-[10px] text-on-surface-variant tracking-wider">Rank</th>
                <th className="text-left py-3 px-4 font-label-caps text-[10px] text-on-surface-variant tracking-wider">Player</th>
                <th className="text-right py-3 px-4 font-label-caps text-[10px] text-on-surface-variant tracking-wider">Chips Won</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((entry, index) => {
                const rank = index + 4;
                const isCurrentUser = entry.user_id === currentUser?.id;
                return (
                  <motion.tr
                    key={entry.user_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.3 }}
                    className={cn(
                      'border-b border-white/5 last:border-none hover:bg-white/5 transition-colors cursor-pointer',
                      isCurrentUser && 'bg-tertiary/5'
                    )}
                    onClick={() => navigate({ to: '/players/$userId', params: { userId: entry.user_id } })}
                  >
                    <td className="py-3 px-4 font-data-mono text-sm text-on-surface">
                      #{rank}
                    </td>
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-on-surface-variant font-mono text-xs">
                        {entry.display_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-on-surface">
                        {entry.display_name}
                        {isCurrentUser && (
                          <span className="ml-2 text-[10px] font-label-caps text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-data-mono text-sm text-tertiary">
                      ${entry.total_chips_won.toLocaleString()}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Your rank sticky bar */}
      {userRank > 0 && userRank > 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-container/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 shadow-xl flex items-center gap-4"
        >
          <span className="text-sm text-on-surface-variant">Your Rank</span>
          <span className="text-2xl font-bold text-tertiary">#{userRank}</span>
          <span className="text-sm text-on-surface-variant">|</span>
          <Link to="/profile" className="text-sm text-on-surface font-medium hover:text-tertiary transition-colors">
            {displayEntries.find((e) => e.user_id === currentUser?.id)?.display_name}
          </Link>
          <Link to="/profile" className="text-sm text-tertiary font-mono hover:text-tertiary/80 transition-colors">
            ${displayEntries.find((e) => e.user_id === currentUser?.id)?.total_chips_won.toLocaleString()}
          </Link>
        </motion.div>
      )}
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Skeleton className="h-8 w-48 bg-white/5 mb-4" />
      <Skeleton className="h-4 w-64 bg-white/5 mb-8" />
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit mb-8">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-24 bg-white/5" />
        ))}
      </div>
      <div className="flex justify-center gap-4 mb-10">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="w-20 h-24 bg-white/5 rounded-t-xl" />
        ))}
      </div>
      <div className="bg-surface-container-lowest/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
