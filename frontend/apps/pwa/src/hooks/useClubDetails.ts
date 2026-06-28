import { useQuery } from '@tanstack/react-query';
import { ClubDetailsSchema } from '../lib/schemas';
import { apiRequest } from '../lib/errorHandler';
import { API } from '../lib/constants';

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
