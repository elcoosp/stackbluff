import { createFileRoute, useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Clock,
  Users,
  Table,
  Award
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Card as CardComponent } from '@/components/game/Card';

export const Route = createFileRoute('/hands/$handId')({
  component: HandDetailPage,
});

interface HandDetail {
  id: string;
  table_id: string;
  played_at: string;
  players: {
    player_id: string;
    user_id?: string;
    display_name?: string;
    seat: number;
    hole_cards?: string[];
    stack_before: number;
    stack_after: number;
    is_dealer: boolean;
  }[];
  actions: {
    player_id: string;
    action_type: string;
    amount?: number;
    timestamp_ms: number;
    street: string;
  }[];
  result: {
    winners: {
      player_id: string;
      hand_rank: number;
      hand_description: string;
      amount_won: number;
    }[];
    community_cards: string[];
    pot_distribution: {
      winner_id: string;
      amount: number;
    }[];
  };
}

type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
type HandAction = HandDetail['actions'][0];

const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown'
};

function HandDetailPage() {
  const params = useParams({ from: '/hands/$handId' });
  const handId = params.handId;
  const { isAuthenticated } = useAuthStore();
  const [currentStreet, setCurrentStreet] = useState<Street>('preflop');
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch hand detail
  const { data: hand, isLoading, error, refetch } = useQuery<HandDetail>({
    queryKey: ['hand', handId],
    queryFn: () => apiClient<HandDetail>(`/hands/${handId}`),
    enabled: isAuthenticated && !!handId,
    staleTime: 60_000,
  });

  // Group actions by street
  const actionsByStreet = useMemo<Record<Street, HandAction[]>>(() => {
    const empty: Record<Street, HandAction[]> = {
      preflop: [],
      flop: [],
      turn: [],
      river: [],
      showdown: [],
    };
    if (!hand) return empty;
    const groups = { ...empty };
    for (const action of hand.actions) {
      const street = action.street as Street;
      if (groups[street]) {
        groups[street].push(action);
      }
    }
    return groups;
  }, [hand]);

  const streets: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];

  // Auto-play logic
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentStreet((prev) => {
        const idx = streets.indexOf(prev);
        if (idx < streets.length - 1) {
          return streets[idx + 1];
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlaying]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Sign In Required</h2>
          <p className="text-on-surface-variant text-sm">Please sign in to view hand details.</p>
          <Link to="/login" className="mt-4 inline-block">
            <Button>Sign In</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <HandDetailSkeleton />;
  }

  if (error || !hand) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error</h2>
          <p className="text-on-surface-variant text-sm">Failed to load hand details.</p>
          <Button onClick={() => refetch()} className="mt-4">Retry</Button>
        </Card>
      </div>
    );
  }

  const currentActions = actionsByStreet[currentStreet] || [];
  const communityCards = hand.result.community_cards || [];
  const winners = hand.result.winners || [];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/history" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <div>
          <h1 className="font-display-lg text-2xl text-on-surface flex items-center gap-2">
            Hand #{handId.slice(0, 8)}
          </h1>
          <div className="flex flex-wrap gap-4 mt-1 text-sm text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {new Date(hand.played_at).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Table className="w-4 h-4" />
              Table {hand.table_id.slice(0, 6)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {hand.players.length} players
            </span>
          </div>
        </div>
      </div>

      {/* Pot & Winner */}
      <Card className="p-4 bg-white/5 border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-on-surface-variant">Pot</span>
            <span className="text-xl font-bold text-tertiary">
              ${hand.result.winners.reduce((sum, w) => sum + w.amount_won, 0)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-on-surface">
              {winners.map((w) => w.hand_description).join(', ')}
            </span>
          </div>
        </div>
      </Card>

      {/* Street Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {streets.map((street) => {
          const hasActions = (actionsByStreet[street] || []).length > 0;
          const isActive = street === currentStreet;
          return (
            <button
              key={street}
              onClick={() => setCurrentStreet(street)}
              disabled={!hasActions}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-tertiary text-on-tertiary'
                  : hasActions
                    ? 'border border-white/10 text-on-surface-variant hover:bg-white/5'
                    : 'text-on-surface-variant/30 cursor-not-allowed'
              )}
            >
              {STREET_LABELS[street]}
              {hasActions && (
                <span className="ml-1 text-xs opacity-60">
                  ({actionsByStreet[street].length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Community Cards */}
      <div className="flex justify-center gap-2 py-4">
        {communityCards.map((card, idx) => {
          let rank = card.slice(0, -1);
          let suit = card.slice(-1);
          const isRevealed = idx < (currentStreet === 'preflop' ? 0 : currentStreet === 'flop' ? 3 : currentStreet === 'turn' ? 4 : 5);
          return (
            <CardComponent
              key={idx}
              rank={isRevealed ? rank : undefined}
              suit={isRevealed ? suit : undefined}
              faceDown={!isRevealed}
              size="md"
              className="w-16 h-24"
            />
          );
        })}
      </div>

      {/* Actions Timeline */}
      <Card className="p-4 bg-white/5 border-white/10 max-h-60 overflow-y-auto">
        <div className="space-y-2">
          {currentActions.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center">No actions in this street.</p>
          ) : (
            currentActions.map((action, idx) => {
              const player = hand.players.find((p) => p.player_id === action.player_id);
              const displayName = player?.display_name || `Player ${action.player_id.slice(0, 4)}`;
              return (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <span className="text-on-surface-variant font-mono w-8">{idx + 1}.</span>
                  <span className="font-medium text-on-surface">{displayName}</span>
                  <span className="text-on-surface-variant">{action.action_type}</span>
                  {action.amount !== undefined && (
                    <span className="text-tertiary font-mono">${action.amount}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const idx = streets.indexOf(currentStreet);
            if (idx > 0) setCurrentStreet(streets[idx - 1]);
          }}
          disabled={currentStreet === 'preflop'}
          className="border-white/10 text-on-surface-variant"
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsPlaying(!isPlaying)}
          className="border-white/10 text-on-surface-variant hover:text-on-surface"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const idx = streets.indexOf(currentStreet);
            if (idx < streets.length - 1) setCurrentStreet(streets[idx + 1]);
          }}
          disabled={currentStreet === 'showdown'}
          className="border-white/10 text-on-surface-variant"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function HandDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 bg-white/5 rounded-lg" />
        <div>
          <Skeleton className="h-8 w-48 bg-white/5" />
          <div className="flex gap-4 mt-1">
            <Skeleton className="h-4 w-32 bg-white/5" />
            <Skeleton className="h-4 w-32 bg-white/5" />
          </div>
        </div>
      </div>
      <Skeleton className="h-20 bg-white/5 rounded-xl" />
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-24 bg-white/5 rounded-lg" />
        ))}
      </div>
      <div className="flex justify-center gap-2 py-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="w-16 h-24 bg-white/5 rounded" />
        ))}
      </div>
      <Skeleton className="h-48 bg-white/5 rounded-xl" />
      <div className="flex justify-center gap-4">
        <Skeleton className="h-10 w-10 bg-white/5 rounded-lg" />
        <Skeleton className="h-10 w-10 bg-white/5 rounded-lg" />
        <Skeleton className="h-10 w-10 bg-white/5 rounded-lg" />
      </div>
    </div>
  );
}
