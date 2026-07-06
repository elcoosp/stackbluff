import { useQuery } from '@tanstack/react-query';

interface SeasonCardResponse {
  season_id: number;
  card_image_url: string | null;
  card_data: Record<string, unknown> | null;
  generated_at: string;
}

export const useSeasonCard = (seasonId: number) => {
  return useQuery<SeasonCardResponse>({
    queryKey: ['season-card', seasonId],
    queryFn: async () => {
      const res = await fetch(`/api/seasons/${seasonId}/card`);
      if (!res.ok) throw new Error('Failed to fetch season card');
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });
};
