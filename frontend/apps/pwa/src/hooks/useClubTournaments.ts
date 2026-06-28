import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TournamentsResponse, ScheduleTournamentRequest } from '../types/club';
import { apiRequest } from '../lib/errorHandler';
import { logger } from '../lib/logger';

export function useClubTournaments(clubId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<TournamentsResponse>({
    queryKey: ['club-tournaments', clubId],
    queryFn: () => apiRequest<TournamentsResponse>(`/clubs/${clubId}/tournaments`, {}, { clubId }),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: 2,
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
      return apiRequest(`/clubs/${clubId}/tournaments`, {
        method: 'POST',
        body: JSON.stringify(data),
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
