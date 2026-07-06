import { useLeaderboard, type LeaderboardEntry } from '../hooks/useLeaderboard';
import { BadgeIcon } from './BadgeIcon';

interface LeaderboardProps {
  userId: string;
}

function LeaderboardRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser?: boolean }) {
  const isTop3 = entry.rank <= 3;
  const rankColor =
    entry.rank === 1 ? 'text-yellow-500' :
      entry.rank === 2 ? 'text-gray-400' :
        entry.rank === 3 ? 'text-amber-600' :
          'text-muted-foreground';

  return (
    <div
      className={`flex items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-accent ${isTop3 ? 'bg-accent/50' : ''
        } ${isCurrentUser ? 'ring-1 ring-primary ring-inset' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className={`w-8 text-right font-mono text-sm font-semibold ${rankColor}`}>#{entry.rank}</span>
        <span className="font-medium">{entry.display_name}</span>
        {isCurrentUser && <BadgeIcon userId={entry.user_id} />}
      </div>
      <span className="font-mono text-sm tabular-nums">{entry.total_chips_won.toLocaleString()}</span>
    </div>
  );
}

export function Leaderboard({ userId }: LeaderboardProps) {
  const { data, isLoading, error, isFetching } = useLeaderboard();

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold">Global Leaderboard</h2>
        <p className="text-sm text-destructive">Failed to load leaderboard. Retrying automatically…</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Global Leaderboard</h2>
        {isFetching && !isLoading && (
          <span className="text-xs text-muted-foreground animate-pulse">Updating…</span>
        )}
      </div>
      <div className="space-y-1">
        {data?.slice(0, 100).map((entry: LeaderboardEntry) => (
          <LeaderboardRow key={entry.user_id} entry={entry} isCurrentUser={entry.user_id === userId} />
        ))}
      </div>
      {data && data.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No leaderboard data yet. Play some hands to see rankings!
        </p>
      )}
    </div>
  );
}

export default Leaderboard;
