import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/errorHandler';
import type { UpdateClubSettingsRequest } from '../lib/schemas';
import { UpdateClubSettingsRequestSchema } from '../lib/schemas';

export function useUpdateClubSettings(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateClubSettingsRequest) => {
      const validated = UpdateClubSettingsRequestSchema.parse(data);
      return apiRequest(
        `/clubs/${clubId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(validated),
        },
        { clubId },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
    },
  });
}
