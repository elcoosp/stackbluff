import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { tournamentApi } from '@stackbluff/shared/api/tournamentApi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Trophy, Calendar, Users, Coins, Sparkles, ChevronRight, LogIn } from 'lucide-react';
import type { TournamentResultEntry, TournamentSummary } from '@stackbluff/shared/types/tournament.types';

export const Route = createFileRoute('/tournaments-history')({
  component: TournamentHistoryPage,
});

interface TournamentWithResults extends TournamentSummary {
  completed_at: string;
  results: TournamentResultEntry[];
}

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
      <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-data-mono uppercase tracking-widest text-orange-400">Past Events</span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface">Tournament History</h1>
        </motion.div>
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-6">
          <Card className="max-w-md w-full p-12 text-center bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl">
            <Trophy className="w-12 h-12 text-orange-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-on-surface mb-2">Sign In Required</h2>
            <p className="text-on-surface-variant text-sm mb-6">
              Please sign in to view your tournament history.
            </p>
            <Link to="/login" className="inline-block">
              <Button className="flex items-center gap-2 px-4 py-2 bg-tertiary text-on-tertiary font-label-caps text-xs hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-lg">
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <HistorySkeleton />;
  }

  if (error) {
    return (
      <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-red-400" />
            <span className="text-xs font-data-mono uppercase tracking-widest text-red-400">Error</span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface">Tournament History</h1>
        </motion.div>
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-6">
          <Card className="max-w-md w-full p-12 text-center bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Failed to Load</h2>
            <p className="text-on-surface-variant text-sm mb-6">
              There was an error loading your tournament history.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-tertiary text-on-tertiary font-label-caps text-xs hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-lg"
            >
              Retry
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-data-mono uppercase tracking-widest text-orange-400">
            Past Events
          </span>
        </div>
        <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface flex items-center gap-3">
          Tournament History
        </h1>
        <p className="text-on-surface-variant text-sm mt-1 max-w-md">
          Review your past performance, winnings, and final standings.
        </p>
      </motion.div>

      {!tournaments || tournaments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="p-12 text-center bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl flex flex-col items-center">
            <Trophy className="w-12 h-12 text-on-surface-variant mx-auto mb-4" />
            <p className="text-on-surface-variant">You haven't participated in any completed tournaments yet.</p>
            <Link to="/tournaments" className="mt-6 inline-block">
              <Button className="flex items-center gap-2 px-4 py-2 bg-tertiary text-on-tertiary font-label-caps text-xs hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-lg">
                <Trophy className="w-4 h-4 mr-1" />
                Browse Tournaments
              </Button>
            </Link>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-4"
        >
          {tournaments.map((tournament) => (
            <motion.div key={tournament.id} variants={itemVariants}>
              <Card className="p-5 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl hover:bg-white/[0.07] transition-colors group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline-md text-base text-on-surface flex items-center gap-2">
                      <span className="truncate">{tournament.name || tournament.tournament_type}</span>
                      <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-on-surface-variant uppercase tracking-wider">
                        {tournament.tournament_type === 'SitAndGo' ? 'Sit & Go' : 'MTT'}
                      </span>
                    </h3>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-on-surface-variant">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-orange-400" />
                        {new Date(tournament.completed_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-orange-400" />
                        {tournament.results.length} participants
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-orange-400" />
                        ${tournament.prize_pool.toLocaleString()} prize
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/tournaments/$tournamentId"
                    params={{ tournamentId: tournament.id }}
                  >
                    <Button
                      variant="outline"
                      className="flex items-center gap-1.5 px-4 py-2 border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-label-caps text-[10px] uppercase tracking-wider rounded-lg"
                    >
                      View Details
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>

                {tournament.results.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="text-[10px] text-on-surface-variant font-label-caps uppercase tracking-wider mb-3">
                      Your Results
                    </div>
                    <div className="space-y-2">
                      {tournament.results.slice(0, 3).map((result) => (
                        <div
                          key={result.user_id}
                          className="flex items-center justify-between px-4 py-2 bg-black/20 border border-white/5 rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-3">
                            {result.position <= 3 ? (
                              <span className="text-lg">
                                {result.position === 1 ? '🥇' : result.position === 2 ? '🥈' : '🥉'}
                              </span>
                            ) : (
                              <span className="text-on-surface-variant w-6 text-center font-mono">#{result.position}</span>
                            )}
                            <span className="text-on-surface font-medium">
                              {result.display_name || 'You'}
                            </span>
                          </div>
                          <span className="text-tertiary font-data-mono font-bold">
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
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24 bg-white/5 rounded" />
        <Skeleton className="h-8 w-64 bg-white/5 rounded" />
        <Skeleton className="h-4 w-96 bg-white/5 rounded" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 bg-white/5 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
