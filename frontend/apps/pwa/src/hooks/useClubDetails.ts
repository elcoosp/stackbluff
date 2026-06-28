import { useQuery } from '@tanstack/react-query';
import type { ClubDetails } from '../types/club';
import { apiRequest } from '../lib/errorHandler';

export function useClubDetails(clubId: string) {
  return useQuery<ClubDetails>({
    queryKey: ['club', clubId],
    queryFn: () => apiRequest<ClubDetails>(`/clubs/${clubId}`, {}, { clubId }),
    staleTime: 60 * 1000,
    retry: 2,
  });
}
