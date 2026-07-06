import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TournamentsResponseSchema, ScheduleTournamentRequestSchema } from '../lib/schemas';
import type { TournamentsResponse, ScheduleTournamentRequest } from '../lib/schemas';
import { apiRequest } from '../lib/errorHandler';
import { logger } from '../lib/logger';
import { API } from '../lib/constants';

export function useClubTournaments(clubId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<TournamentsResponse>({
    queryKey: ['club-tournaments', clubId],
    queryFn: async () => {
      const data = await apiRequest<unknown>(`/clubs/${clubId}/tournaments`, {}, { clubId });
      return TournamentsResponseSchema.parse(data);
    },
    staleTime: API.STALE_TIME_SHORT,
    refetchInterval: API.ONE_MINUTE,
    retry: API.DEFAULT_RETRY_COUNT,
  });

  const registerMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      return apiRequest(`/tournaments/${tournamentId}/register`, { method: 'POST' }, { tournamentId });
    },
    onMutate: async (tournamentId) => {
      await queryClient.cancelQueries({ queryKey: ['club-tournaments', clubId] });

      const previousTournaments = queryClient.getQueryData<TournamentsResponse>(['club-tournaments', clubId]);

      queryClient.setQueryData<TournamentsResponse>(['club-tournaments', clubId], (old) => {
        if (!old) return old;
        return {
          ...old,
          tournaments: old.tournaments.map((t) =>
            t.id === tournamentId
              ? { ...t, is_registered: true, current_registrations: t.current_registrations + 1 }
              : t
          ),
        };
      });

      return { previousTournaments };
    },
    onError: (err, tournamentId, context) => {
      logger.error('Failed to register for tournament', err instanceof Error ? err : undefined, {
        tournamentId,
        clubId,
      });
      if (context?.previousTournaments) {
        queryClient.setQueryData(['club-tournaments', clubId], context.previousTournaments);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      return apiRequest(`/tournaments/${tournamentId}/register`, { method: 'DELETE' }, { tournamentId });
    },
    onMutate: async (tournamentId) => {
      await queryClient.cancelQueries({ queryKey: ['club-tournaments', clubId] });

      const previousTournaments = queryClient.getQueryData<TournamentsResponse>(['club-tournaments', clubId]);

      queryClient.setQueryData<TournamentsResponse>(['club-tournaments', clubId], (old) => {
        if (!old) return old;
        return {
          ...old,
          tournaments: old.tournaments.map((t) =>
            t.id === tournamentId
              ? { ...t, is_registered: false, current_registrations: Math.max(0, t.current_registrations - 1) }
              : t
          ),
        };
      });

      return { previousTournaments };
    },
    onError: (err, tournamentId, context) => {
      logger.error('Failed to unregister from tournament', err instanceof Error ? err : undefined, {
        tournamentId,
        clubId,
      });
      if (context?.previousTournaments) {
        queryClient.setQueryData(['club-tournaments', clubId], context.previousTournaments);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async (data: ScheduleTournamentRequest) => {
      const validated = ScheduleTournamentRequestSchema.parse(data);
      return apiRequest(`/clubs/${clubId}/tournaments`, {
        method: 'POST',
        body: JSON.stringify(validated),
      }, { clubId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
    },
    onError: (err) => {
      logger.error('Failed to schedule tournament', err instanceof Error ? err : undefined, { clubId });
    },
  });

  return {
    ...query,
    register: registerMutation.mutateAsync,
    unregister: unregisterMutation.mutateAsync,
    scheduleTournament: scheduleMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    isUnregistering: unregisterMutation.isPending,
    isScheduling: scheduleMutation.isPending,
  };
}
