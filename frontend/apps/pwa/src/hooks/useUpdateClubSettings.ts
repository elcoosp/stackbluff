import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateClubSettingsRequest } from '../types/club';
import { apiRequest } from '../lib/errorHandler';

export function useUpdateClubSettings(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateClubSettingsRequest) => {
      return apiRequest(`/clubs/${clubId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }, { clubId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
    },
  });
}
