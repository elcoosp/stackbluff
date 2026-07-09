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
import { History } from 'lucide-react';

import { LobbyTabs } from '@/components/lobby/LobbyTabs';

// @ts-ignore – route will be added to route tree on dev server restart
export const Route = createFileRoute('/tournaments')({
  component: TournamentsPage,
});

type TypeFilter = 'All' | 'SitAndGo' | 'Mtt';
type StatusFilter = 'All' | 'Registering' | 'Running' | 'Completed';

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
      toast.success('Registered successfully!');
      if (userId) setRegistered(tournamentId, userId, true);
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setRegisteringId(null);
      setBuyInDialog({ open: false, tournament: null });
    },

    onError: (error, { tournamentId }) => {
      toast.error(error.message || 'Registration failed');
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
      toast.success('Unregistered successfully');
      if (userId) setRegistered(tournamentId, userId, false);
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setUnregisteringId(null);
    },

    onError: (error, { tournamentId }) => {
      toast.error(error.message || 'Unregistration failed');
      setUnregisteringId(null);
    },
  });

  const handleRegister = (tournament: TournamentSummary) => {
    if (!userId) {
      toast.error('Please log in first');
      return;
    }
    if (registeredUsers[tournament.id]?.[userId]) {
      toast.info('You are already registered for this tournament');
      return;
    }
    setBuyInDialog({ open: true, tournament });
  };

  const handleConfirmRegistration = () => {
    if (!buyInDialog.tournament || !userId) {
      toast.error('Your session has expired. Please log in again.');
      setBuyInDialog({ open: false, tournament: null });
      return;
    }
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
        toast.info('You are not seated yet. Wait for the tournament to start.');
      }
    } catch (error) {
      toast.error('Failed to get table. Please try again.');
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
    <div className="flex-1 relative">
      <div className="absolute inset-0 carbon-bg pointer-events-none" />
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 pb-28 md:pb-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-8 md:mb-12">
          <div>
            <h1 className="font-display-lg text-3xl md:text-display-lg text-on-surface mb-2 flex items-center gap-2">
              Tournaments
            </h1>
            <p className="text-on-surface-variant max-w-md text-sm md:text-base">
              Sit & Go and Multi-Table Tournaments. Register now and compete for the prize pool.
            </p>
          </div>
          <LobbyTabs />
        </div>

        <div className="flex items-center justify-between mb-4">
          <Link
            to="/tournaments-history"
            className="text-sm text-tertiary hover:text-tertiary/80 transition-colors flex items-center gap-1"
          >
            <History className="w-4 h-4" />
            History
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex flex-wrap gap-1 bg-white/5 rounded-lg p-1">
            {typeTabs.map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={cn(
                  'px-4 py-1.5 text-xs font-medium rounded-md transition-colors',
                  typeFilter === type
                    ? 'bg-tertiary text-on-tertiary'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/10'
                )}
              >
                {type === 'All' ? 'All Types' : type === 'SitAndGo' ? 'Sit & Go' : 'MTT'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 bg-white/5 rounded-lg p-1">
            {statusTabs.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-4 py-1.5 text-xs font-medium rounded-md transition-colors',
                  statusFilter === status
                    ? 'bg-tertiary text-on-tertiary'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/10'
                )}
              >
                {status === 'All' ? 'All Status' : status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {tournamentsQuery.isLoading ? (
            <div className="text-center py-8 text-on-surface-variant text-sm">Loading tournaments...</div>
          ) : tournamentsQuery.error ? (
            <div className="text-red-400 text-sm text-center py-8">Failed to load tournaments. Retrying...</div>
          ) : filteredTournaments.length === 0 ? (
            <div className="text-center py-8 text-on-surface-variant text-sm">No tournaments match the current filters.</div>
          ) : (
            filteredTournaments.map((tournament) => {
              const cached = tournamentCache[tournament.id];
              const registered = cached?.registered ?? tournament.registered;
              const isRegistered = userId ? !!(registeredUsers[tournament.id]?.[userId]) : false;
              return (
                <TournamentCard
                  key={tournament.id}
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
              );
            })
          )}
        </div>
      </div>

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
