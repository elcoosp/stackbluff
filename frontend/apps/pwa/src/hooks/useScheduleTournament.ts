import { apiClient } from '@stackbluff/shared/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ScheduleTournamentRequest {
  name: string;
  max_players: number;
  buy_in: number;
  scheduled_start: string;
  blind_schedule_id?: string;
}

export function useScheduleTournament(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ScheduleTournamentRequest) => {
      return apiClient(`/clubs/${clubId}/tournaments`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate tournaments list to refetch
      queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
    },
  });
}
