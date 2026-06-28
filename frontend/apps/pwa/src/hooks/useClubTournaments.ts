import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared/api/client';

export interface Tournament {
  id: string;
  name: string;
  scheduled_start: string;
  buy_in: number;
  max_players: number;
  current_registrations: number;
  status: 'Scheduled' | 'Registering' | 'Running' | 'Completed';
  is_registered: boolean;
  blind_schedule_id?: string;
}

interface TournamentsResponse {
  tournaments: Tournament[];
}

export function useClubTournaments(clubId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<TournamentsResponse>({
    queryKey: ['club-tournaments', clubId],
    queryFn: async () => {
      return apiClient<TournamentsResponse>(`/clubs/${clubId}/tournaments`);
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
  });

  const registerMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      return apiClient(`/tournaments/${tournamentId}/register`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      return apiClient(`/tournaments/${tournamentId}/register`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
    },
  });

  return {
    ...query,
    register: registerMutation.mutateAsync,
    unregister: unregisterMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    isUnregistering: unregisterMutation.isPending,
  };
}
