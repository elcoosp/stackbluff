import { useQuery } from '@tanstack/react-query';
import { API } from '../lib/constants';
import { apiRequest } from '../lib/errorHandler';
import { ClubDetailsSchema } from '../lib/schemas';

export function useClubDetails(clubId: string) {
  return useQuery({
    queryKey: ['club', clubId],
    queryFn: async () => {
      const data = await apiRequest<unknown>(`/clubs/${clubId}`, {}, { clubId });
      return ClubDetailsSchema.parse(data);
    },
    staleTime: API.STALE_TIME_MEDIUM,
    retry: API.DEFAULT_RETRY_COUNT,
  });
}
