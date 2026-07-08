import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@stackbluff/shared/api/client';
import { tournamentApi } from '@stackbluff/shared/api/tournamentApi';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useTournamentStore } from '@stackbluff/shared/stores/tournamentStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Trophy,
  Users,
  Coins,
  Clock,
  Calendar,
  Zap,
  Eye,
  LogIn,
  UserPlus,
  UserMinus,
  Medal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TournamentSummary, TournamentResultEntry, PayoutEntry } from '@stackbluff/shared/types/tournament.types';
import { BlindSchedulePreview } from '@/components/tournament/BlindSchedulePreview';
import { PayoutStructurePreview } from '@/components/tournament/PayoutStructurePreview';

export const Route = createFileRoute('/tournaments/$tournamentId')({
  component: TournamentDetailPage,
});

function TournamentDetailPage() {
  const navigate = useNavigate();
  const params = useParams({ from: '/tournaments/$tournamentId' });
  const tournamentId = params.tournamentId;
  const userId = useAuthStore((s) => s.user?.id);
  const setTournamentState = useTournamentStore((s) => s.setTournamentState);
  const tournamentState = useTournamentStore((s) => s.tournamentStates[tournamentId]);
  const [showPayouts, setShowPayouts] = useState(false);

  // Fetch tournament details
  const { data: tournament, isLoading, error, refetch } = useQuery<TournamentSummary>({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentApi.get(tournamentId),
    enabled: !!tournamentId,
    staleTime: 30_000,
  });

  // Fetch tournament results if completed
  const { data: results } = useQuery<TournamentResultEntry[]>({
    queryKey: ['tournament-results', tournamentId],
    queryFn: () => tournamentApi.results(tournamentId).then((res) => (res.results || []) as TournamentResultEntry[]),
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
      toast.success('Registered successfully!');
      queryClient.invalidateQueries({ queryKey: ['tournament-registrations', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      // Update store
      if (userId) {
        useTournamentStore.getState().setRegistered(tournamentId, userId, true);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Registration failed');
    },
  });

  // Unregister mutation
  const unregisterMutation = useMutation({
    mutationFn: () => tournamentApi.unregister(tournamentId, userId!),
    onSuccess: () => {
      toast.success('Unregistered successfully');
      queryClient.invalidateQueries({ queryKey: ['tournament-registrations', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      if (userId) {
        useTournamentStore.getState().setRegistered(tournamentId, userId, false);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unregistration failed');
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
          <h2 className="text-xl font-semibold text-red-400 mb-2">Tournament Not Found</h2>
          <p className="text-on-surface-variant text-sm">
            The tournament you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate({ to: '/tournaments' })} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tournaments
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
    // Navigate to table with tournament context
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
        Back to Tournaments
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display-lg text-3xl text-on-surface flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-400" />
            {tournament.name || `${tournament.tournament_type} Tournament`}
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge
              variant={isRegistering ? 'default' : isRunning ? 'secondary' : 'outline'}
              className="text-xs"
            >
              {isRegistering ? 'Registering' : isRunning ? 'Live' : 'Completed'}
            </Badge>
            <span className="text-sm text-on-surface-variant">
              {tournament.tournament_type === 'SitAndGo' ? 'Sit & Go' : 'MTT'}
            </span>
            <span className="text-sm text-on-surface-variant">
              <Users className="w-4 h-4 inline mr-1" />
              {tournament.registered}/{tournament.max_players}
            </span>
            <span className="text-sm text-on-surface-variant">
              <Coins className="w-4 h-4 inline mr-1" />
              Buy-in: ${tournament.buy_in.toLocaleString()}
            </span>
            <span className="text-sm text-tertiary font-mono">
              Prize: ${tournament.prize_pool.toLocaleString()}
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
              {registerMutation.isPending ? 'Registering...' : 'Register'}
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
              {unregisterMutation.isPending ? '...' : 'Unregister'}
            </Button>
          )}
          {canPlay && (
            <Button onClick={handlePlay} className="bg-tertiary text-on-tertiary hover:bg-tertiary-fixed">
              <LogIn className="w-4 h-4 mr-2" />
              Play
            </Button>
          )}
          {canSpectate && (
            <Button onClick={handleSpectate} variant="outline" className="border-white/10 hover:border-tertiary">
              <Eye className="w-4 h-4 mr-2" />
              Spectate
            </Button>
          )}
          {isRegistered && isRegistering && (
            <Badge variant="secondary" className="self-center">Registered</Badge>
          )}
        </div>
      </div>

      {/* Progress / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 bg-white/5 border-white/10">
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <Users className="w-4 h-4" />
            Registrations
          </div>
          <div className="mt-1">
            <div className="text-xl font-bold text-on-surface">{tournament.registered}</div>
            <Progress value={(tournament.registered / tournament.max_players) * 100} className="mt-1 h-1" />
            <div className="text-xs text-on-surface-variant mt-1">
              {tournament.max_players - tournament.registered} spots left
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white/5 border-white/10">
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <Coins className="w-4 h-4" />
            Prize Pool
          </div>
          <div className="mt-1">
            <div className="text-xl font-bold text-tertiary">
              ${tournament.prize_pool.toLocaleString()}
            </div>
            <div className="text-xs text-on-surface-variant mt-1">
              {tournament.buy_in > 0 ? `${tournament.registered} × $${tournament.buy_in}` : 'Free entry'}
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white/5 border-white/10">
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <Clock className="w-4 h-4" />
            Status
          </div>
          <div className="mt-1">
            <div className="text-xl font-bold text-on-surface">
              {isRegistering ? 'Registering' : isRunning ? 'Live' : 'Completed'}
            </div>
            <div className="text-xs text-on-surface-variant mt-1">
              {tournament.started_at ? `Started ${new Date(tournament.started_at).toLocaleString()}` : 'Not started yet'}
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
            Final Results
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
                <span className="text-tertiary font-mono">
                  ${result.prize.toLocaleString()}
                </span>
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
