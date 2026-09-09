import { apiClient } from '@stackbluff/shared/api/client';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  Coins,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
  Table,
  Trophy,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

interface TableInfo {
  table_id: string;
  name: string;
  stake_level: string;
  max_players: number;
  current_players: number;
  status: string;
}

type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
type HandAction = HandDetail['actions'][0];

const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
  },
};

// Helper to format card strings like "FourHearts" -> "4 ♥" (with colors)
const formatLargeCard = (cardStr: string) => {
  if (!cardStr || typeof cardStr !== 'string') return null;

  const suits: Record<string, { symbol: string; color: string }> = {
    Hearts: { symbol: '♥', color: 'text-red-500' },
    Diamonds: { symbol: '♦', color: 'text-red-500' },
    Clubs: { symbol: '♣', color: 'text-black' },
    Spades: { symbol: '♠', color: 'text-black' },
  };

  const ranks: Record<string, string> = {
    Ace: 'A',
    King: 'K',
    Queen: 'Q',
    Jack: 'J',
    Ten: '10',
    Nine: '9',
    Eight: '8',
    Seven: '7',
    Six: '6',
    Five: '5',
    Four: '4',
    Three: '3',
    Two: '2',
  };

  for (const [name, { symbol, color }] of Object.entries(suits)) {
    if (cardStr.endsWith(name)) {
      const rank = cardStr.slice(0, -name.length);
      const shortRank = ranks[rank] || rank;

      return (
        <div className="w-16 h-24 bg-white rounded-lg shadow-xl border border-black/10 flex flex-col items-center justify-between p-1.5 select-none">
          <span className={cn('text-sm font-bold leading-none self-start', color)}>
            {shortRank}
          </span>
          <span className={cn('text-2xl leading-none', color)}>{symbol}</span>
          <span className={cn('text-sm font-bold leading-none self-end rotate-180', color)}>
            {shortRank}
          </span>
        </div>
      );
    }
  }
  return (
    <div className="w-16 h-24 bg-white rounded-lg shadow-xl border border-black/10 flex items-center justify-center text-black text-xs font-mono p-1 text-center break-all">
      {cardStr}
    </div>
  );
};

const CardBack = () => (
  <div className="w-16 h-24 rounded-lg shadow-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center">
    <div className="w-12 h-20 rounded-md border-2 border-white/5 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.05)_4px,rgba(255,255,255,0.05)_8px)]" />
  </div>
);

function HandDetailPage() {
  const params = useParams({ from: '/hands/$handId' });
  const handId = params.handId;
  const { user } = useAuthStore();
  const [currentStreet, setCurrentStreet] = useState<Street>('preflop');
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch hand detail
  const {
    data: hand,
    isLoading,
    error,
    refetch,
  } = useQuery<HandDetail>({
    queryKey: ['hand', handId],
    queryFn: () => apiClient<HandDetail>(`/hands/${handId}`),
    enabled: true && !!handId,
    staleTime: 60_000,
  });

  // Fetch lobby tables to map table_id to table_name
  // Using try/catch inside queryFn to gracefully handle failures without crashing the page
  const { data: tablesData } = useQuery<TableInfo[]>({
    queryKey: ['lobby-tables'],
    queryFn: async () => {
      try {
        return await apiClient<TableInfo[]>('/lobby');
      } catch (_err) {
        // If the endpoint fails, return an empty array to avoid unhandled errors
        return [];
      }
    },
    enabled: true,
    staleTime: 60_000,
  });

  const tableMap = useMemo(() => {
    const map = new Map<string, string>();
    if (tablesData) {
      tablesData.forEach((t) => {
        map.set(t.table_id, t.name);
      });
    }
    return map;
  }, [tablesData]);

  // Centralized Name Resolution
  const getPlayerName = (playerId: string) => {
    if (!hand) return 'Player';
    const player = hand.players.find((p) => p.player_id === playerId);

    if (player?.display_name) return player.display_name;
    if (player?.user_id && player.user_id === user?.id) return 'You';
    if (player?.seat !== undefined) return `Player ${player.seat + 1}`;

    return `Player ${playerId?.slice(0, 4) || '????'}`;
  };

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
    }, 2000);
    return () => clearInterval(timer);
  }, [isPlaying, streets]);

  if (isLoading) {
    return <HandDetailSkeleton />;
  }

  if (error || !hand) {
    return (
      <div className="relative max-w-5xl mx-auto p-4 md:p-8">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <ErrorState onRetry={() => refetch()} message="Failed to load hand details." />
      </div>
    );
  }

  const currentActions = actionsByStreet[currentStreet] || [];
  const communityCards = hand.result?.community_cards || [];
  const winners = hand.result?.winners || [];
  const totalPot = winners.reduce((sum, w) => sum + (w.amount_won || 0), 0);

  const revealedCount =
    currentStreet === 'preflop'
      ? 0
      : currentStreet === 'flop'
        ? 3
        : currentStreet === 'turn'
          ? 4
          : 5;

  // Fallback to ID slice if the table name isn't fetched or found
  const tableName =
    tableMap.get(hand.table_id) || `Table ${hand.table_id ? hand.table_id.slice(0, 6) : '------'}`;

  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-4"
      >
        <Link
          to="/history"
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-data-mono uppercase tracking-widest text-blue-400">
              Hand Replay
            </span>
          </div>
          <h1 className="font-display-lg text-2xl md:text-3xl text-on-surface truncate">
            Hand #{handId ? handId.slice(0, 8) : '...'}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(hand.played_at).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="flex items-center gap-1">
              <Table className="w-3 h-3" />
              <span className="font-data-mono text-on-surface-variant/80">{tableName}</span>
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {hand.players.length} players
            </span>
          </div>
        </div>
      </motion.div>

      {/* Pot & Winner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="p-5 bg-gradient-to-br from-yellow-500/5 to-transparent border-white/10 backdrop-blur-xl rounded-2xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                <Coins className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-[10px] font-data-mono uppercase tracking-wider text-on-surface-variant">
                  Total Pot
                </p>
                <p className="font-display text-2xl text-on-surface leading-tight">
                  ${totalPot.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-1">
              <p className="text-[10px] font-data-mono uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                <Trophy className="w-3 h-3 text-yellow-400" />
                Winner
              </p>
              {winners.length > 0 ? (
                winners.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-on-surface">
                      {getPlayerName(w.player_id)}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10 font-mono text-[10px]"
                    >
                      {w.hand_description}
                    </Badge>
                  </div>
                ))
              ) : (
                <span className="text-sm text-on-surface-variant">No winner data</span>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Street Navigation & Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1 flex w-full gap-1 bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-xl">
          {streets.map((street) => {
            const hasActions = (actionsByStreet[street] || []).length > 0;
            const isActive = street === currentStreet;
            return (
              <button
                key={street}
                onClick={() => {
                  setCurrentStreet(street);
                  setIsPlaying(false);
                }}
                disabled={!hasActions}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white/10 text-on-surface shadow-sm'
                    : hasActions
                      ? 'text-on-surface-variant hover:text-on-surface'
                      : 'text-on-surface-variant/30 cursor-not-allowed',
                )}
              >
                {STREET_LABELS[street]}
                {hasActions && (
                  <span
                    className={cn(
                      'text-[9px] font-data-mono px-1.5 py-0.5 rounded-md',
                      isActive
                        ? 'bg-white/10 text-on-surface'
                        : 'bg-white/5 text-on-surface-variant',
                    )}
                  >
                    {actionsByStreet[street].length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const idx = streets.indexOf(currentStreet);
              if (idx > 0) setCurrentStreet(streets[idx - 1]);
              setIsPlaying(false);
            }}
            disabled={currentStreet === 'preflop'}
            className="text-on-surface-variant hover:text-on-surface hover:bg-white/10 rounded-xl px-3 disabled:opacity-30"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="bg-tertiary text-black hover:bg-tertiary/90 rounded-xl px-4 py-2.5 h-auto"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const idx = streets.indexOf(currentStreet);
              if (idx < streets.length - 1) setCurrentStreet(streets[idx + 1]);
              setIsPlaying(false);
            }}
            disabled={currentStreet === 'showdown'}
            className="text-on-surface-variant hover:text-on-surface hover:bg-white/10 rounded-xl px-3 disabled:opacity-30"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Community Cards */}
      <motion.div
        layout
        className="flex justify-center items-center gap-2 md:gap-3 py-6 bg-black/20 border border-white/5 rounded-2xl backdrop-blur-sm min-h-[140px]"
      >
        {[0, 1, 2, 3, 4].map((idx) => (
          <AnimatePresence mode="popLayout" key={idx}>
            {idx < revealedCount ? (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.5, rotateY: 180 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.5, rotateY: 180 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {formatLargeCard(communityCards[idx])}
              </motion.div>
            ) : (
              <motion.div layout initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}>
                <CardBack />
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </motion.div>

      {/* Actions Timeline */}
      <Card className="p-5 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl">
        <h3 className="font-headline-md text-base text-on-surface mb-4 flex items-center gap-2">
          {STREET_LABELS[currentStreet]} Actions
        </h3>
        <motion.div
          key={currentStreet}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2 max-h-[300px] overflow-y-auto pr-2 relative
          [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full"
        >
          {currentActions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-on-surface-variant">No actions recorded in this street.</p>
            </div>
          ) : (
            currentActions.map((action, idx) => {
              const displayName = getPlayerName(action.player_id);
              const type = action.action_type?.toLowerCase() || 'action';

              let actionColor = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
              if (type.includes('fold') || type.includes('muck'))
                actionColor = 'bg-red-500/10 text-red-400 border-red-500/20';
              else if (type.includes('check') || type.includes('call'))
                actionColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
              else if (type.includes('bet') || type.includes('raise'))
                actionColor = 'bg-tertiary/10 text-tertiary border-tertiary/20';
              else if (type.includes('blind'))
                actionColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';

              return (
                <motion.div
                  key={idx}
                  variants={itemVariants}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors"
                >
                  <span className="text-[10px] font-data-mono text-on-surface-variant/50 w-6 text-right">
                    {idx + 1}
                  </span>
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="font-medium text-on-surface text-sm truncate">
                      {displayName}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('font-mono text-[10px] border', actionColor)}
                    >
                      {action.action_type}
                    </Badge>
                  </div>
                  {action.amount !== undefined && action.amount > 0 && (
                    <span className="text-sm text-tertiary font-mono font-semibold">
                      ${action.amount.toLocaleString()}
                    </span>
                  )}
                </motion.div>
              );
            })
          )}
        </motion.div>
      </Card>
    </div>
  );
}

function HandDetailSkeleton() {
  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="animate-pulse space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-11 w-11 bg-white/5 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24 bg-white/5" />
            <Skeleton className="h-7 w-48 bg-white/5" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-24 bg-white/5" />
              <Skeleton className="h-3 w-24 bg-white/5" />
            </div>
          </div>
        </div>
        <Skeleton className="h-24 bg-white/5 rounded-2xl" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 flex-1 bg-white/5 rounded-xl" />
          ))}
        </div>
        <div className="flex justify-center items-center gap-3 py-8 bg-white/[0.02] rounded-2xl">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="w-16 h-24 bg-white/5 rounded-lg" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
