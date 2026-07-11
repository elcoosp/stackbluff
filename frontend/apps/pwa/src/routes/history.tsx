import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
  Calendar,
  Sparkles,
  Trophy,
  TrendingUp,
  Coins,
  Eye,
  ChevronRight,
  Crown,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';

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

type FilterType = 'all' | 'wins' | 'losses';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const FILTERS: { value: FilterType; label: string; icon: typeof Layers }[] = [
  { value: 'all', label: 'All', icon: Layers },
  { value: 'wins', label: 'Wins', icon: Trophy },
  { value: 'losses', label: 'Losses', icon: TrendingUp },
];

// Helper to format card strings like "FourHearts" -> "4 ♥" (with colors)
const formatCard = (cardStr: string) => {
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
        <span className="flex items-center justify-center font-bold text-black">
          <span className="text-xs leading-none">{shortRank}</span>
          <span className={cn('ml-0.5 text-sm leading-none', color)}>{symbol}</span>
        </span>
      );
    }
  }
  return <span className="text-black text-xs">{cardStr}</span>;
};

function HistoryPage() {
  const { isAuthenticated } = useAuthStore();
  const [limit] = useState(20);
  const [filter, setFilter] = useState<FilterType>('all');

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
      <div className="relative min-h-[80vh] flex items-center justify-center p-6">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="max-w-md w-full p-8 text-center bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <History className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="font-display-lg text-xl text-on-surface mb-2">Sign In Required</h2>
            <p className="text-on-surface-variant text-sm">
              Please sign in to view your hand history and track your sessions.
            </p>
            <Link to="/login" className="mt-5 inline-block">
              <Button className="bg-tertiary text-black hover:bg-tertiary/90">Sign In</Button>
            </Link>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return <HistorySkeleton />;
  }

  if (error) {
    return (
      <div className="relative max-w-5xl mx-auto p-4 md:p-8">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <ErrorState onRetry={() => refetch()} message="Failed to load hand history." />
      </div>
    );
  }

  const histories = data?.pages.flatMap((p) => p.histories) || [];
  const total = data?.pages[0]?.total || 0;
  const userId = useAuthStore.getState().user?.id;

  // Compute stats from loaded data
  let wins = 0;
  let biggestPot = 0;
  let totalWinnings = 0;
  histories.forEach((h) => {
    const myWin = h.winners.find((w) => w.user_id === userId);
    if (myWin) {
      wins++;
      totalWinnings += myWin.amount;
    }
    if (h.pot > biggestPot) biggestPot = h.pot;
  });
  const losses = histories.length - wins;
  const winRate = histories.length > 0 ? Math.round((wins / histories.length) * 100) : 0;

  const filtered =
    filter === 'wins'
      ? histories.filter((h) => h.winners.some((w) => w.user_id === userId))
      : filter === 'losses'
        ? histories.filter((h) => !h.winners.some((w) => w.user_id === userId))
        : histories;

  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-data-mono uppercase tracking-widest text-blue-400">
            Your Sessions
          </span>
        </div>
        <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface flex items-center gap-3">
          Hand History
        </h1>
        <p className="text-on-surface-variant text-sm mt-1 max-w-md">
          Review every hand you've played. Track wins, study decisions, and improve your game.
        </p>
      </motion.div>

      {/* Stats Row */}
      {histories.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <StatCard
            icon={Layers}
            label="Total Hands"
            value={total.toLocaleString()}
            tint="blue"
          />
          <StatCard
            icon={Trophy}
            label="Win Rate"
            value={`${winRate}%`}
            sub={`${wins}W / ${losses}L`}
            tint="tertiary"
          />
          <StatCard
            icon={Coins}
            label="Winnings"
            value={`$${totalWinnings.toLocaleString()}`}
            tint="yellow"
          />
          <StatCard
            icon={Crown}
            label="Biggest Pot"
            value={`$${biggestPot.toLocaleString()}`}
            tint="purple"
          />
        </motion.div>
      )}

      {/* Empty State */}
      {histories.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="p-12 text-center bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <Table className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="font-headline-md text-lg text-on-surface mb-1">No hands played yet</h3>
              <p className="text-on-surface-variant text-sm max-w-sm mx-auto">
                Join a table and start playing to build your hand history. Every hand you play will appear here.
              </p>
              <Link to="/lobby" className="mt-5 inline-block">
                <Button className="bg-tertiary text-black hover:bg-tertiary/90">
                  Find a Table
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Filter Tabs */}
      {histories.length > 0 && (
        <div className="flex w-full gap-1 bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-xl">
          {FILTERS.map(({ value, label, icon: Icon }) => {
            const count =
              value === 'wins' ? wins : value === 'losses' ? losses : histories.length;
            const active = filter === value;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-white/10 text-on-surface'
                    : 'text-on-surface-variant hover:text-on-surface'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                <span
                  className={cn(
                    'text-[10px] font-data-mono px-1.5 py-0.5 rounded-md',
                    active ? 'bg-white/10 text-on-surface' : 'bg-white/5 text-on-surface-variant'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Hand History List */}
      {histories.length > 0 && (
        <>
          {filtered.length === 0 ? (
            <Card className="p-10 text-center bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl">
              <p className="text-on-surface-variant text-sm">
                No {filter === 'wins' ? 'wins' : 'losses'} in your loaded history.
              </p>
            </Card>
          ) : (
            <motion.div
              key={filter}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-3"
            >
              {filtered.map((hand, idx) => (
                <motion.div key={hand.id} variants={itemVariants}>
                  <HandHistoryCard hand={hand} index={idx} />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Load more */}
          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                variant="outline"
                className="border-white/10 bg-white/5 backdrop-blur-xl text-on-surface-variant hover:text-on-surface hover:bg-white/10 rounded-xl px-6"
              >
                {isFetchingNextPage ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="inline-block"
                    >
                      <Layers className="w-4 h-4 mr-2" />
                    </motion.span>
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Load More Hands
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
  sub?: string;
  tint: 'blue' | 'tertiary' | 'yellow' | 'purple';
}) {
  const tints = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    tertiary: 'bg-tertiary/10 border-tertiary/20 text-tertiary',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  };
  return (
    <motion.div variants={itemVariants}>
      <Card className="p-4 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl hover:bg-white/[0.07] transition-colors h-full">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0',
              tints[tint]
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-data-mono uppercase tracking-wider text-on-surface-variant truncate">
              {label}
            </p>
            <p className="font-display text-lg text-on-surface leading-tight truncate">{value}</p>
            {sub && <p className="text-[10px] text-on-surface-variant mt-0.5">{sub}</p>}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function HandHistoryCard({ hand, index }: { hand: HandSummary; index: number }) {
  const userId = useAuthStore.getState().user?.id;
  const navigate = useNavigate();
  const winner = hand.winners[0];
  const myWin = hand.winners.find((w) => w.user_id === userId);
  const isWin = !!myWin;
  const isSplit = hand.winners.length > 1;

  const handleView = (handId: string) => {
    navigate({ to: '/hands/$handId', params: { handId } });
  };

  const handRank = winner?.hand_rank || 'Hand';

  return (
    <Card
      className={cn(
        'p-5 border backdrop-blur-xl rounded-2xl transition-all duration-300 hover:bg-white/[0.07] group relative overflow-hidden',
        isWin
          ? 'bg-gradient-to-br from-tertiary/10 to-transparent border-tertiary/20'
          : 'bg-white/5 border-white/10'
      )}
    >
      {/* Subtle glow accent for wins */}
      {isWin && (
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-tertiary/10 rounded-full blur-3xl pointer-events-none" />
      )}

      <div className="relative flex items-center gap-4">
        {/* Index / Rank Number */}
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center font-data-mono text-sm font-bold border flex-shrink-0 transition-colors',
            isWin
              ? 'bg-tertiary/10 border-tertiary/30 text-tertiary'
              : 'bg-white/5 border-white/10 text-on-surface-variant'
          )}
        >
          {String(index + 1).padStart(2, '0')}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-headline-md text-base text-on-surface">{handRank}</h3>
            <Badge
              variant="outline"
              className={cn(
                'font-mono text-[10px]',
                isWin
                  ? 'border-tertiary/30 text-tertiary bg-tertiary/10'
                  : 'border-white/20 text-on-surface-variant bg-white/5'
              )}
            >
              {isWin ? (
                <>
                  <Trophy className="w-3 h-3 mr-1" />
                  {isSplit ? 'Split Win' : 'Win'}
                </>
              ) : (
                'Loss'
              )}
            </Badge>
            <span
              className={cn(
                'font-data-mono text-sm font-semibold',
                isWin ? 'text-tertiary' : 'text-on-surface-variant'
              )}
            >
              ${hand.pot.toLocaleString()}
            </span>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(hand.played_at).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="flex items-center gap-1">
              <Table className="w-3 h-3" />
              Table{' '}
              <span className="font-data-mono text-on-surface-variant/80">
                {hand.table_id.slice(0, 6)}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {hand.winners.length} winner{hand.winners.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Community cards preview */}
          {hand.community_cards && hand.community_cards.length > 0 && (
            <div className="flex gap-1.5 mt-2.5">
              {hand.community_cards.map((card, idx) => (
                <span
                  key={idx}
                  className="w-8 h-10 flex items-center justify-center bg-white rounded-[4px] shadow-sm border border-black/10"
                >
                  {formatCard(card)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* View action */}
        <div className="flex-shrink-0 self-stretch flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleView(hand.id)}
            className="text-on-surface-variant hover:text-on-surface hover:bg-white/10 rounded-xl group/btn"
          >
            <Eye className="w-4 h-4 mr-1.5 transition-transform group-hover/btn:scale-110" />
            <span className="hidden sm:inline">View</span>
            <ChevronRight className="w-3.5 h-3.5 ml-0.5 transition-transform group-hover/btn:translate-x-0.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function HistorySkeleton() {
  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="animate-pulse space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28 bg-white/5" />
          <Skeleton className="h-9 w-52 bg-white/5" />
          <Skeleton className="h-4 w-72 bg-white/5" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 bg-white/5 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
