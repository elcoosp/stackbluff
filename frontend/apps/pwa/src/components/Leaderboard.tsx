import { Trans } from '@lingui/react/macro';
import { type LeaderboardEntry, useLeaderboard } from '../hooks/useLeaderboard';
import { BadgeIcon } from './BadgeIcon';
import { cn } from '@/lib/utils';

interface LeaderboardProps {
  userId: string;
}

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
}) {
  const isTop3 = entry.rank <= 3;
  const rankColor = entry.rank === 1 ? 'text-yellow-400' : 'text-on-surface-variant';

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 transition-colors hover:border-tertiary/30 hover:bg-white/[0.06]',
        isTop3 ? 'bg-white/[0.06]' : 'bg-white/[0.04]',
        isCurrentUser ? 'ring-1 ring-tertiary ring-inset' : '',
      )}
    >
      <div className="flex items-center gap-3">
        <span className={`w-8 text-right font-mono text-sm font-semibold ${rankColor}`}>
          #{entry.rank}
        </span>
        <span className="font-medium text-on-surface">{entry.display_name}</span>
        {isCurrentUser && <BadgeIcon userId={entry.user_id} />}
      </div>
      <span className="font-mono text-sm tabular-nums text-on-surface-variant">
        {entry.total_chips_won.toLocaleString()}
      </span>
    </div>
  );
}

export function Leaderboard({ userId }: LeaderboardProps) {
  const { data, isLoading, error, isFetching } = useLeaderboard();

  if (isLoading) {
    return (
      <div className="rounded-2xl raised-panel p-6">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-white/5" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity
              key={`skeleton-${i}-${userId}`}
              className="h-10 animate-pulse rounded-md bg-white/5"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl raised-panel p-6">
        <h2 className="mb-2 text-lg font-semibold text-on-surface">
          <Trans>Global Leaderboard</Trans>
        </h2>
        <p className="text-sm text-red-400">
          <Trans>Failed to load leaderboard. Retrying automatically…</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl raised-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">
          <Trans>Global Leaderboard</Trans>
        </h2>
        {isFetching && !isLoading && (
          <span className="text-xs text-on-surface-variant animate-pulse">
            <Trans>Updating…</Trans>
          </span>
        )}
      </div>
      <div className="space-y-1">
        {data?.slice(0, 100).map((entry: LeaderboardEntry) => (
          <LeaderboardRow
            key={entry.user_id}
            entry={entry}
            isCurrentUser={entry.user_id === userId}
          />
        ))}
      </div>
      {data && data.length === 0 && (
        <p className="py-8 text-center text-sm text-on-surface-variant">
          <Trans>No leaderboard data yet. Play some hands to see rankings!</Trans>
        </p>
      )}
    </div>
  );
}

export default Leaderboard;
