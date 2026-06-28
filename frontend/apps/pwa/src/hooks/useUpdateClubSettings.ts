import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared/api/client';

interface UpdateClubSettingsRequest {
  name?: string;
  logo_url?: string;
  telegram_group_id?: string;
  pro_settings?: {
    banner_url?: string;
    chip_preset?: string;
    felt_colour?: string;
  };
}

export function useUpdateClubSettings(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateClubSettingsRequest) => {
      return apiClient(`/clubs/${clubId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate club details to refetch
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
    },
  });
}
