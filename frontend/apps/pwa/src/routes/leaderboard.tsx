// frontend/apps/pwa/src/routes/leaderboard.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { data: entries, isLoading, error } = useLeaderboard();
  const currentUser = useAuthStore((s) => s.user);

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display-lg text-3xl md:text-display-lg text-on-surface mb-2">Leaderboard</h1>
      <p className="text-on-surface-variant text-sm mb-8">Top players by total chips won.</p>

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
              {entries.map((entry, index) => {
                const isCurrentUser = entry.user_id === currentUser?.id;
                return (
                  <motion.tr
                    key={entry.user_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.3 }}
                    className={cn(
                      'border-b border-white/5 last:border-none hover:bg-white/5 transition-colors',
                      isCurrentUser && 'bg-tertiary/5'
                    )}
                  >
                    <td className="py-3 px-4 font-data-mono text-sm text-on-surface">
                      #{entry.rank}
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
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Skeleton className="h-8 w-48 bg-white/5 mb-4" />
      <Skeleton className="h-4 w-64 bg-white/5 mb-8" />
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
