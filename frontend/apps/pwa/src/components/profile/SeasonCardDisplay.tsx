import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface SeasonCard {
  id: string;
  season: number;
  rank: string;
  image_url: string;
  earned_at: string;
}

export function SeasonCardDisplay() {
  const { data: cards, isLoading, error } = useQuery<SeasonCard[]>({
    queryKey: ['season-cards'],
    queryFn: () => apiClient<SeasonCard[]>('/season-cards'),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto py-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="w-32 h-48 rounded-lg flex-shrink-0" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-on-surface-variant"><Trans>Failed to load season cards.</Trans></p>;
  }

  // SAFETY: ensure data is an array before using .map()
  const safeCards = Array.isArray(cards) ? cards : [];

  if (safeCards.length === 0) {
    return <p className="text-sm text-on-surface-variant"><Trans>No season cards yet. Play more to earn them!</Trans></p>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto py-2">
      {safeCards.map((card) => (
        <Card key={card.id} className="w-32 h-48 flex-shrink-0 bg-white/5 border-white/10 overflow-hidden">
          <div className="relative w-full h-full">
            <img src={card.image_url} alt={t`Season ${card.season}`} className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2">
              <p className="text-xs text-white font-semibold"><Trans>Season {card.season}</Trans></p>
              <p className="text-[10px] text-tertiary">{card.rank}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
