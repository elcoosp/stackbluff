import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTournamentsQuery } from '../hooks/useTournamentsQuery';
import { TournamentCard } from '../components/tournament/TournamentCard';
import { TournamentBuyInDialog } from '../components/tournament/TournamentBuyInDialog';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tournamentApi } from '@stackbluff/shared/api/tournamentApi';
import { useTournamentStore } from '@stackbluff/shared/stores/tournamentStore';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { toast } from 'sonner';
import type { TournamentSummary } from '@stackbluff/shared/types/tournament.types';
import { cn } from '@/lib/utils';
import { History, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { LobbyTabs } from '@/components/lobby/LobbyTabs';
import { trackTournamentRegistration } from '@/lib/customAnalytics';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

export const Route = createFileRoute('/tournaments')({
  component: TournamentsPage,
});

type TypeFilter = 'All' | 'SitAndGo' | 'Mtt';
type StatusFilter = 'All' | 'Registering' | 'Running' | 'Completed';

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

function TournamentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const balance = useAuthStore((s) => s.balance);
  const { tournaments: tournamentCache, registeredUsers, setRegistered } = useTournamentStore();
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [unregisteringId, setUnregisteringId] = useState<string | null>(null);
  const [buyInDialog, setBuyInDialog] = useState<{ open: boolean; tournament: TournamentSummary | null }>({
    open: false,
    tournament: null,
  });

  // Filter state
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  // Fetch tournaments with type filter
  const typeParam = typeFilter !== 'All' ? typeFilter : undefined;
  const tournamentsQuery = useTournamentsQuery({ type: typeParam });
  const allTournaments = tournamentsQuery.data || [];

  // Apply status filter client-side
  const filteredTournaments = allTournaments.filter((t) => {
    if (statusFilter === 'All') return true;
    return t.status === statusFilter;
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.tournamentId) {
        queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      }
    };
    window.addEventListener('tournament:registered', handler as EventListener);
    return () => {
      window.removeEventListener('tournament:registered', handler as EventListener);
    };
  }, [queryClient]);

  const registerMutation = useMutation({
    mutationFn: ({ tournamentId, userId }: { tournamentId: string; userId: string }) =>
      tournamentApi.register(tournamentId, userId),

    onMutate: ({ tournamentId }) => {
      setRegisteringId(tournamentId);
    },

    onSuccess: (_, { tournamentId }) => {
      toast.success(t`Registered successfully!`);
      if (userId) setRegistered(tournamentId, userId, true);
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setRegisteringId(null);
      setBuyInDialog({ open: false, tournament: null });
    },

    onError: (error, { tournamentId }) => {
      toast.error(error.message || t`Registration failed`);
      setRegisteringId(null);
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: ({ tournamentId, userId }: { tournamentId: string; userId: string }) =>
      tournamentApi.unregister(tournamentId, userId),

    onMutate: ({ tournamentId }) => {
      setUnregisteringId(tournamentId);
    },

    onSuccess: (_, { tournamentId }) => {
      toast.success(t`Unregistered successfully`);
      if (userId) setRegistered(tournamentId, userId, false);
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setUnregisteringId(null);
    },

    onError: (error, { tournamentId }) => {
      toast.error(error.message || t`Unregistration failed`);
      setUnregisteringId(null);
    },
  });

  const handleRegister = (tournament: TournamentSummary) => {
    if (!userId) {
      toast.error(t`Please log in first`);
      return;
    }
    if (registeredUsers[tournament.id]?.[userId]) {
      toast.info(t`You are already registered for this tournament`);
      return;
    }
    setBuyInDialog({ open: true, tournament });
  };

  const handleConfirmRegistration = () => {
    if (!buyInDialog.tournament || !userId) {
      toast.error(t`Your session has expired. Please log in again.`);
      setBuyInDialog({ open: false, tournament: null });
      return;
    }
    trackTournamentRegistration(
      buyInDialog.tournament.id,
      buyInDialog.tournament.name || '',
      buyInDialog.tournament.buy_in
    );
    registerMutation.mutate({
      tournamentId: buyInDialog.tournament.id,
      userId,
    });
  };

  const handleSpectate = (tournamentId: string) => {
    navigate({
      to: '/table/$tableId',
      params: { tableId: tournamentId },
      search: { observe: 'true', tournamentId },
    });
  };

  const handlePlay = async (tournamentId: string) => {
    try {
      const data = await tournamentApi.getMyTable(tournamentId);
      if (data.table_id) {
        navigate({
          to: '/table/$tableId',
          params: { tableId: data.table_id },
          search: { tournamentId },
        });
      } else {
        toast.info(t`You are not seated yet. Wait for the tournament to start.`);
      }
    } catch (error) {
      toast.error(t`Failed to get table. Please try again.`);
    }
  };

  const handleResults = (tournamentId: string) => {
    navigate({
      to: '/tournaments/$tournamentId',
      params: { tournamentId },
    });
  };

  const typeTabs: TypeFilter[] = ['All', 'SitAndGo', 'Mtt'];
  const statusTabs: StatusFilter[] = ['All', 'Registering', 'Running', 'Completed'];

  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-data-mono uppercase tracking-widest text-yellow-400">
              <Trans>Compete & Win</Trans>
            </span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface flex items-center gap-3">
            <Trans>Tournaments</Trans>
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 max-w-md">
            <Trans>Sit & Go and Multi-Table Tournaments. Register now and compete for the prize pool.</Trans>
          </p>
        </div>
        <LobbyTabs />
      </motion.div>

      <div className="flex items-center justify-end">
        <Link
          to="/tournaments-history"
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-label-caps text-[10px] uppercase tracking-wider rounded-lg transition-colors"
        >
          <History className="w-3.5 h-3.5" />
          <Trans>History</Trans>
        </Link>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="flex flex-wrap gap-1 bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl p-1.5">
          {typeTabs.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                'px-4 py-2 text-xs font-medium rounded-lg transition-all flex-1',
                typeFilter === type
                  ? 'bg-white/10 text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
              )}
            >
              {type === 'All' ? t`All Types` : type === 'SitAndGo' ? t`Sit & Go` : t`MTT`}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl p-1.5">
          {statusTabs.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-4 py-2 text-xs font-medium rounded-lg transition-all flex-1',
                statusFilter === status
                  ? 'bg-white/10 text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
              )}
            >
              {status === 'All' ? t`All Status` : status}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-3"
      >
        {tournamentsQuery.isLoading ? (
          <div className="text-center py-8 text-on-surface-variant text-sm"><Trans>Loading tournaments...</Trans></div>
        ) : tournamentsQuery.error ? (
          <div className="text-red-400 text-sm text-center py-8"><Trans>Failed to load tournaments. Retrying...</Trans></div>
        ) : filteredTournaments.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant text-sm"><Trans>No tournaments match the current filters.</Trans></div>
        ) : (
          filteredTournaments.map((tournament) => {
            const cached = tournamentCache[tournament.id];
            const registered = cached?.registered ?? tournament.registered;
            const isRegistered = userId ? !!(registeredUsers[tournament.id]?.[userId]) : false;
            return (
              <motion.div key={tournament.id} variants={itemVariants}>
                <TournamentCard
                  tournament={{ ...tournament, registered }}
                  isRegistered={isRegistered}
                  isRegistering={registeringId === tournament.id}
                  isUnregistering={unregisteringId === tournament.id}
                  onRegister={() => handleRegister(tournament)}
                  onUnregister={() => {
                    if (userId) {
                      unregisterMutation.mutate({ tournamentId: tournament.id, userId });
                    }
                  }}
                  onSpectate={() => handleSpectate(tournament.id)}
                  onPlay={() => handlePlay(tournament.id)}
                  onResults={() => handleResults(tournament.id)}
                />
              </motion.div>
            );
          })
        )}
      </motion.div>

      {buyInDialog.tournament && (
        <TournamentBuyInDialog
          open={buyInDialog.open}
          onClose={() => setBuyInDialog({ open: false, tournament: null })}
          onConfirm={handleConfirmRegistration}
          buyIn={buyInDialog.tournament.buy_in}
          currentBalance={balance}
          isProcessing={registerMutation.isPending}
          tournamentName={buyInDialog.tournament.name || ''}
        />
      )}
    </div>
  );
}
