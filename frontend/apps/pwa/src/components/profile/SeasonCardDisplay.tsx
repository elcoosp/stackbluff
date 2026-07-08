import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Trophy, Calendar, Award } from 'lucide-react';

interface SeasonCard {
  season_id: number;
  rank_tier: string;
  card_image_url?: string;
  generated_at: string;
}

export function SeasonCardDisplay() {
  const { data: currentSeason, isLoading: seasonLoading } = useQuery({
    queryKey: ['season', 'current'],
    queryFn: () => apiClient<{ id: number; name: string }>('/seasons/current'),
    staleTime: 60_000,
  });

  const { data: cards, isLoading: cardsLoading } = useQuery<SeasonCard[]>({
    queryKey: ['season-cards'],
    queryFn: () => apiClient<SeasonCard[]>('/season-cards'),
    staleTime: 60_000,
  });

  const isLoading = seasonLoading || cardsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32 bg-white/5" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="text-center py-8 text-on-surface-variant">
        No season cards yet. Complete a season to earn one!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {currentSeason && (
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Calendar className="w-4 h-4" />
          Current Season: <span className="text-on-surface font-medium">{currentSeason.name}</span>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.season_id} className="bg-white/5 border-white/10 overflow-hidden group hover:border-tertiary/30 transition-colors">
            <CardContent className="p-0">
              {card.card_image_url ? (
                <img
                  src={card.card_image_url}
                  alt={`Season ${card.season_id} card`}
                  className="w-full aspect-[4/3] object-cover"
                />
              ) : (
                <div className="w-full aspect-[4/3] bg-gradient-to-br from-tertiary/20 to-tertiary/5 flex flex-col items-center justify-center">
                  <Trophy className="w-8 h-8 text-tertiary/50 mb-2" />
                  <span className="text-xs font-medium text-on-surface-variant">
                    Season {card.season_id}
                  </span>
                  <span className="text-xs text-on-surface-variant/50">{card.rank_tier}</span>
                </div>
              )}
              <div className="p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-on-surface">
                  Season {card.season_id}
                </span>
                <span className="text-xs text-tertiary">{card.rank_tier}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
