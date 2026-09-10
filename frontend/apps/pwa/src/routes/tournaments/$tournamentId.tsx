import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { apiClient } from '@stackbluff/shared/api/client';
import { tournamentApi } from '@stackbluff/shared/api/tournamentApi';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useTournamentStore } from '@stackbluff/shared/stores/tournamentStore';
import type {
  TournamentResultEntry,
  TournamentSummary,
} from '@stackbluff/shared/types/tournament.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  Clock,
  Coins,
  Eye,
  LogIn,
  Medal,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BlindSchedulePreview } from '@/components/tournament/BlindSchedulePreview';
import { PayoutStructurePreview } from '@/components/tournament/PayoutStructurePreview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/tournaments/$tournamentId')({
  component: TournamentDetailPage,
});

function TournamentDetailPage() {
  const navigate = useNavigate();
  const params = useParams({ from: '/tournaments/$tournamentId' });
  const tournamentId = params.tournamentId;
  const userId = useAuthStore((s) => s.user?.id);
  const _setTournamentState = useTournamentStore((s) => s.setTournamentState);
  const tournamentState = useTournamentStore((s) => s.tournamentStates[tournamentId]);
  const [_showPayouts, _setShowPayouts] = useState(false);

  // Fetch tournament details
  const {
    data: tournament,
    isLoading,
    error,
  } = useQuery<TournamentSummary>({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentApi.get(tournamentId),
    enabled: !!tournamentId,
    staleTime: 30_000,
  });

  // Fetch tournament results if completed
  const { data: results } = useQuery<TournamentResultEntry[]>({
    queryKey: ['tournament-results', tournamentId],
    queryFn: () =>
      tournamentApi
        .results(tournamentId)
        .then((res) => (res.results || []) as TournamentResultEntry[]),
    enabled: !!tournamentId && tournament?.status === 'Completed',
    staleTime: 60_000,
  });

  // Fetch registrations to determine if user is registered
  const { data: registrations } = useQuery<{ user_id: string }[]>({
    queryKey: ['tournament-registrations', tournamentId],
    queryFn: () => apiClient<{ user_id: string }[]>(`/tournaments/${tournamentId}/registrations`),
    enabled: !!tournamentId && !!userId,
    staleTime: 10_000,
  });

  const isRegistered = registrations?.some((r) => r.user_id === userId) || false;

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: () => tournamentApi.register(tournamentId, userId!),
    onSuccess: () => {
      toast.success(t`Registered successfully!`);
      queryClient.invalidateQueries({ queryKey: ['tournament-registrations', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      if (userId) {
        useTournamentStore.getState().setRegistered(tournamentId, userId, true);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t`Registration failed`);
    },
  });

  // Unregister mutation
  const unregisterMutation = useMutation({
    mutationFn: () => tournamentApi.unregister(tournamentId, userId!),
    onSuccess: () => {
      toast.success(t`Unregistered successfully`);
      queryClient.invalidateQueries({ queryKey: ['tournament-registrations', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      if (userId) {
        useTournamentStore.getState().setRegistered(tournamentId, userId, false);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t`Unregistration failed`);
    },
  });

  const queryClient = useQueryClient();

  if (isLoading) {
    return <TournamentDetailSkeleton />;
  }

  if (error || !tournament) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">
            <Trans>Tournament Not Found</Trans>
          </h2>
          <p className="text-on-surface-variant text-sm">
            <Trans>The tournament you're looking for doesn't exist or has been removed.</Trans>
          </p>
          <Button onClick={() => navigate({ to: '/tournaments' })} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <Trans>Back to Tournaments</Trans>
          </Button>
        </Card>
      </div>
    );
  }

  const isRegistering = tournament.status === 'Registering';
  const isRunning = tournament.status === 'Running';
  const isCompleted = tournament.status === 'Completed';
  const isFull = tournament.registered >= tournament.max_players;
  const canRegister = isRegistering && !isFull && !isRegistered && userId;
  const canUnregister = isRegistering && isRegistered && userId;
  const canSpectate = isRunning && !isRegistered;
  const canPlay = isRunning && isRegistered;

  const handlePlay = () => {
    navigate({
      to: '/table/$tableId',
      params: { tableId: tournamentId },
      search: { tournamentId },
    });
  };

  const handleSpectate = () => {
    navigate({
      to: '/table/$tableId',
      params: { tableId: tournamentId },
      search: { observe: 'true', tournamentId },
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back button */}
      <Button
        variant="ghost"
        className="mb-4 text-on-surface-variant hover:text-on-surface"
        onClick={() => navigate({ to: '/tournaments' })}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        <Trans>Back to Tournaments</Trans>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display-lg text-3xl text-on-surface flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-400" />
            {tournament.name || `${tournament.tournament_type} <Trans>Tournament</Trans>`}
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge
              variant={isRegistering ? 'default' : isRunning ? 'secondary' : 'outline'}
              className="text-xs"
            >
              {isRegistering ? t`Registering` : isRunning ? t`Live` : t`Completed`}
            </Badge>
            <span className="text-sm text-on-surface-variant">
              {tournament.tournament_type === 'SitAndGo' ? t`Sit & Go` : t`MTT`}
            </span>
            <span className="text-sm text-on-surface-variant">
              <Users className="w-4 h-4 inline mr-1" />
              {tournament.registered}/{tournament.max_players}
            </span>
            <span className="text-sm text-on-surface-variant">
              <Coins className="w-4 h-4 inline mr-1" />
              <Trans>Buy-in: ${tournament.buy_in.toLocaleString()}</Trans>
            </span>
            <span className="text-sm text-tertiary font-mono">
              <Trans>Prize: ${tournament.prize_pool.toLocaleString()}</Trans>
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {canRegister && (
            <Button
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending}
              className="bg-tertiary text-on-tertiary hover:bg-tertiary-fixed"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {registerMutation.isPending ? t`Registering...` : t`Register`}
            </Button>
          )}
          {canUnregister && (
            <Button
              onClick={() => unregisterMutation.mutate()}
              disabled={unregisterMutation.isPending}
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <UserMinus className="w-4 h-4 mr-2" />
              {unregisterMutation.isPending ? '...' : t`Unregister`}
            </Button>
          )}
          {canPlay && (
            <Button
              onClick={handlePlay}
              className="bg-tertiary text-on-tertiary hover:bg-tertiary-fixed"
            >
              <LogIn className="w-4 h-4 mr-2" />
              <Trans>Play</Trans>
            </Button>
          )}
          {canSpectate && (
            <Button
              onClick={handleSpectate}
              variant="outline"
              className="border-white/10 hover:border-tertiary"
            >
              <Eye className="w-4 h-4 mr-2" />
              <Trans>Spectate</Trans>
            </Button>
          )}
          {isRegistered && isRegistering && (
            <Badge variant="secondary" className="self-center">
              <Trans>Registered</Trans>
            </Badge>
          )}
        </div>
      </div>

      {/* Progress / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 bg-white/5 border-white/10">
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <Users className="w-4 h-4" />
            <Trans>Registrations</Trans>
          </div>
          <div className="mt-1">
            <div className="text-xl font-bold text-on-surface">{tournament.registered}</div>
            <Progress
              value={(tournament.registered / tournament.max_players) * 100}
              className="mt-1 h-1"
            />
            <div className="text-xs text-on-surface-variant mt-1">
              <Trans>{tournament.max_players - tournament.registered} spots left</Trans>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white/5 border-white/10">
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <Coins className="w-4 h-4" />
            <Trans>Prize Pool</Trans>
          </div>
          <div className="mt-1">
            <div className="text-xl font-bold text-tertiary">
              ${tournament.prize_pool.toLocaleString()}
            </div>
            <div className="text-xs text-on-surface-variant mt-1">
              {tournament.buy_in > 0
                ? `${tournament.registered} × $${tournament.buy_in}`
                : t`Free entry`}
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white/5 border-white/10">
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <Clock className="w-4 h-4" />
            <Trans>Status</Trans>
          </div>
          <div className="mt-1">
            <div className="text-xl font-bold text-on-surface">
              {isRegistering ? t`Registering` : isRunning ? t`Live` : t`Completed`}
            </div>
            <div className="text-xs text-on-surface-variant mt-1">
              {tournament.started_at
                ? t`Started ${new Date(tournament.started_at).toLocaleString()}`
                : t`Not started yet`}
            </div>
          </div>
        </Card>
      </div>

      {/* Blind Schedule */}
      {tournament.blind_levels && tournament.blind_levels.length > 0 && (
        <BlindSchedulePreview
          levels={tournament.blind_levels}
          currentLevel={tournamentState?.blind_level}
          className="mb-6"
        />
      )}

      {/* Payout Structure */}
      {tournament.payout_structure && tournament.payout_structure.length > 0 && (
        <PayoutStructurePreview
          entries={tournament.payout_structure}
          prizePool={tournament.prize_pool}
          className="mb-6"
        />
      )}

      {/* Results if completed */}
      {isCompleted && results && results.length > 0 && (
        <Card className="p-4 bg-white/5 border-white/10">
          <h3 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
            <Medal className="w-5 h-5 text-yellow-400" />
            <Trans>Final Results</Trans>
          </h3>
          <div className="space-y-1">
            {results.map((result) => (
              <div
                key={result.user_id}
                className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-on-surface-variant w-8 text-center">
                    #{result.position}
                  </span>
                  <span className="text-on-surface truncate">
                    {result.display_name || result.user_id.slice(0, 8)}
                  </span>
                </div>
                <span className="text-tertiary font-mono">${result.prize.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function TournamentDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 animate-pulse">
      <Skeleton className="h-10 w-32 bg-white/5 mb-4" />
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <Skeleton className="h-10 w-64 bg-white/5 mb-2" />
          <div className="flex gap-3">
            <Skeleton className="h-6 w-20 bg-white/5" />
            <Skeleton className="h-6 w-20 bg-white/5" />
            <Skeleton className="h-6 w-20 bg-white/5" />
          </div>
        </div>
        <Skeleton className="h-10 w-32 bg-white/5" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 bg-white/5 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 bg-white/5 rounded-xl" />
    </div>
  );
}
