import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { tournamentApi } from '@stackbluff/shared/api/tournamentApi';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, ArrowLeft, Calendar, Users, Coins } from 'lucide-react';
import type { TournamentResultEntry, TournamentSummary } from '@stackbluff/shared/types/tournament.types';

export const Route = createFileRoute('/tournaments-history')({
  component: TournamentHistoryPage,
});

interface TournamentWithResults extends TournamentSummary {
  completed_at: string;
  results: TournamentResultEntry[];
}

function TournamentHistoryPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: tournaments, isLoading, error } = useQuery<TournamentWithResults[]>({
    queryKey: ['tournament-history', userId],
    queryFn: async () => {
      const all = await tournamentApi.list({ status: 'Completed' });
      const withResults = await Promise.all(
        all.map(async (t: TournamentSummary) => {
          const detail = await tournamentApi.get(t.id);
          const resultsRes = await tournamentApi.results(t.id);
          const userResults = userId
            ? resultsRes.results.filter((r: any) => r.user_id === userId)
            : resultsRes.results;
          return {
            ...t,
            completed_at: (detail as any).completed_at || new Date().toISOString(),
            results: userResults || [],
          } as TournamentWithResults;
        })
      );
      return userId ? withResults.filter(t => t.results.length > 0) : withResults;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Sign In Required</h2>
          <p className="text-on-surface-variant text-sm">
            Please sign in to view your tournament history.
          </p>
          <Link to="/login" className="mt-4 inline-block">
            <button className="px-6 py-2 bg-tertiary text-on-tertiary rounded-lg">Sign In</button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <HistorySkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error</h2>
          <p className="text-on-surface-variant text-sm">
            Failed to load tournament history.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-tertiary text-on-tertiary rounded-lg"
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }

  if (!tournaments || tournaments.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate({ to: '/tournaments' })}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
          </button>
          <h1 className="font-display-lg text-2xl text-on-surface">Tournament History</h1>
        </div>
        <Card className="p-12 text-center">
          <Trophy className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
          <p className="text-on-surface-variant">You haven't participated in any completed tournaments yet.</p>
          <Link to="/tournaments" className="mt-4 inline-block">
            <button className="px-6 py-2 bg-tertiary text-on-tertiary rounded-lg">Browse Tournaments</button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ to: '/tournaments' })}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </button>
        <h1 className="font-display-lg text-2xl text-on-surface">Tournament History</h1>
      </div>

      <div className="space-y-4">
        {tournaments.map((tournament) => (
          <Card key={tournament.id} className="p-4 hover:bg-white/5 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-on-surface flex items-center gap-2">
                  <span>{tournament.name || tournament.tournament_type}</span>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-on-surface-variant">
                    {tournament.tournament_type}
                  </span>
                </h3>
                <div className="flex flex-wrap gap-4 mt-1 text-sm text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(tournament.completed_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {tournament.results.length} participants
                  </span>
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" />
                    ${tournament.prize_pool.toLocaleString()} prize
                  </span>
                </div>
              </div>
              <Link
                to="/tournaments/$tournamentId"
                params={{ tournamentId: tournament.id }}
                className="text-tertiary hover:text-tertiary/80 text-sm font-medium"
              >
                View Details →
              </Link>
            </div>

            {tournament.results.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="text-xs text-on-surface-variant font-label-caps uppercase tracking-wider mb-2">
                  Your Results
                </div>
                <div className="space-y-1">
                  {tournament.results.slice(0, 3).map((result) => (
                    <div
                      key={result.user_id}
                      className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {result.position <= 3 ? (
                          <span className="text-lg">
                            {result.position === 1 ? '🥇' : result.position === 2 ? '🥈' : '🥉'}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant w-6 text-center">#{result.position}</span>
                        )}
                        <span className="text-on-surface">
                          {result.display_name || 'You'}
                        </span>
                      </div>
                      <span className="text-tertiary font-mono">
                        ${result.prize.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {tournament.results.length > 3 && (
                    <div className="text-xs text-on-surface-variant text-center pt-1">
                      +{tournament.results.length - 3} more...
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-10 w-10 bg-white/5 rounded-lg" />
        <Skeleton className="h-8 w-48 bg-white/5" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 bg-white/5 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
