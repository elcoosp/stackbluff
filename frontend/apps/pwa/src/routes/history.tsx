import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  History,
  Table,
  Users,
  Coins,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  ArrowLeft,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

import { ErrorState } from '@/components/ui/ErrorState';
import { useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/history')({
  component: HistoryPage,
});

interface HandSummary {
  id: string;
  table_id: string;
  played_at: string;
  pot: number;
  winners: {
    user_id: string;
    amount: number;
    hand_rank: string;
  }[];
  community_cards: string[];
  winner_hole_cards?: string[];
}

interface HistoryResponse {
  histories: HandSummary[];
  total: number;
  next_cursor?: string;
}

function HistoryPage() {
  const { isAuthenticated } = useAuthStore();
  const [limit] = useState(20);

  // Fetch hand history
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['hand-history', limit],
      queryFn: async ({ pageParam }) => {
        const url = `/hands?limit=${limit}${pageParam ? `&cursor=${pageParam}` : ''}`;
        return apiClient<HistoryResponse>(url);
      },
      getNextPageParam: (lastPage) => lastPage.next_cursor,
      initialPageParam: undefined as string | undefined,
      enabled: isAuthenticated,
      staleTime: 60_000,
    });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Sign In Required</h2>
          <p className="text-on-surface-variant text-sm">Please sign in to view your hand history.</p>
          <Link to="/login" className="mt-4 inline-block">
            <Button>Sign In</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <HistorySkeleton />;
  }

  if (error) {
    return <ErrorState onRetry={() => refetch()} message="Failed to load hand history." />;
  }

  const histories = data?.pages.flatMap((p) => p.histories) || [];
  const total = data?.pages[0]?.total || 0;

  if (histories.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="font-display-lg text-2xl text-on-surface flex items-center gap-2">
            <History className="w-6 h-6 text-tertiary" />
            Hand History
          </h1>
        </div>
        <Card className="p-12 text-center">
          <Table className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
          <p className="text-on-surface-variant">No hands played yet.</p>
          <p className="text-on-surface-variant/60 text-sm mt-2">Start playing to see your hand history.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-lg text-3xl text-on-surface flex items-center gap-2">
            <History className="w-8 h-8 text-tertiary" />
            Hand History
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            {total} hands played
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {histories.map((hand) => (
          <HandHistoryCard key={hand.id} hand={hand} />
        ))}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            variant="outline"
            className="border-white/10 text-on-surface-variant hover:text-on-surface"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}

function HandHistoryCard({ hand }: { hand: HandSummary }) {
  const userId = useAuthStore.getState().user?.id;
  const winner = hand.winners[0];
  const isWin = winner?.user_id === userId;

  const navigate = useNavigate();
  const handleView = (handId: string) => {
    navigate({ to: '/hands/$handId', params: { handId } });
  };

  return (
    <Card className={cn(
      'p-4 border transition-colors',
      isWin ? 'border-tertiary/20 bg-tertiary/5' : 'border-white/10'
    )}>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-on-surface">
              {hand.winners.length > 1 ? 'Split Pot' : `${winner?.hand_rank || 'Hand'}`}
            </span>
            <Badge variant={isWin ? 'default' : 'outline'} className={isWin ? 'bg-tertiary/20 text-tertiary' : 'border-white/20 text-on-surface-variant'}>
              {isWin ? 'Win' : 'Loss'}
            </Badge>
            <span className="text-sm text-tertiary font-mono">
              ${hand.pot}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 mt-1 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(hand.played_at).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Table className="w-3 h-3" />
              Table {hand.table_id.slice(0, 6)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {hand.winners.length} winner{hand.winners.length > 1 ? 's' : ''}
            </span>
          </div>
          {/* Community cards preview */}
          {hand.community_cards && hand.community_cards.length > 0 && (
            <div className="flex gap-1 mt-2">
              {hand.community_cards.map((card, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-white/5 rounded text-xs font-mono">
                  {card}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleView(hand.id)}
            className="text-on-surface-variant hover:text-on-surface"
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
        </div>
      </div>
    </Card>
  );
}

function HistorySkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 bg-white/5" />
          <Skeleton className="h-4 w-32 bg-white/5 mt-1" />
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24 bg-white/5 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
