import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Users,
  Calendar,
  Share2,
  Eye,
  Sparkles,
  Play,
  ChevronRight,
  Crown,
  Layers,
  Coins,
  ArrowRight,
  Table,
} from 'lucide-react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/ui/ErrorState';

export const Route = createFileRoute('/replays')({
  component: ReplaysPage,
});

interface ReplayCard {
  id: string;
  hand_description: string;
  winner_name: string;
  winner_id: string;
  pot: number;
  played_at: string;
  table_id: string;
  community_cards?: string[];
  winner_cards?: string[];
  share_url: string;
}

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

function ReplaysPage() {
  const { isAuthenticated } = useAuthStore();

  const { data: replays, isLoading, error, refetch } = useQuery<ReplayCard[]>({
    queryKey: ['replays'],
    queryFn: () => apiClient<ReplayCard[]>('/replays'),
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
              <Play className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="font-display-lg text-xl text-on-surface mb-2">Sign In Required</h2>
            <p className="text-on-surface-variant text-sm">
              Please sign in to view your replay cards and share your biggest wins.
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
    return <ReplaysSkeleton />;
  }

  if (error || !replays) {
    return (
      <div className="relative max-w-5xl mx-auto p-4 md:p-8">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <ErrorState onRetry={() => refetch()} message="Failed to load replay cards." />
      </div>
    );
  }

  const totalReplays = replays.length;
  const totalWinnings = replays.reduce((sum, r) => sum + r.pot, 0);
  const biggestPot = replays.length > 0 ? Math.max(...replays.map((r) => r.pot)) : 0;

  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span className="text-xs font-data-mono uppercase tracking-widest text-yellow-400">
            Your Highlights
          </span>
        </div>
        <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface flex items-center gap-3">
          Replay Cards
        </h1>
        <p className="text-on-surface-variant text-sm mt-1 max-w-md">
          Relive your most significant hands and share your victories with friends.
        </p>
      </motion.div>

      {/* Stats Row */}
      {totalReplays > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          <StatCard icon={Layers} label="Total Replays" value={totalReplays.toLocaleString()} tint="blue" />
          <StatCard icon={Coins} label="Total Won" value={`$${totalWinnings.toLocaleString()}`} tint="tertiary" />
          <StatCard icon={Crown} label="Biggest Pot" value={`$${biggestPot.toLocaleString()}`} tint="yellow" />
        </motion.div>
      )}

      {/* Empty State */}
      {totalReplays === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="p-12 text-center bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-purple-500/5 pointer-events-none" />
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="font-headline-md text-lg text-on-surface mb-1">No replay cards yet</h3>
              <p className="text-on-surface-variant text-sm max-w-sm mx-auto">
                Play more hands to unlock replay cards. Your biggest wins will appear here to be shared.
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

      {/* Replays Grid */}
      {totalReplays > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {replays.map((replay, idx) => (
            <motion.div key={replay.id} variants={itemVariants}>
              <ReplayCardItem replay={replay} index={idx} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
  tint: 'blue' | 'tertiary' | 'yellow';
}) {
  const tints = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    tertiary: 'bg-tertiary/10 border-tertiary/20 text-tertiary',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  };
  return (
    <Card className="p-4 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl hover:bg-white/[0.07] transition-colors h-full">
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0', tints[tint])}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-data-mono uppercase tracking-wider text-on-surface-variant truncate">
            {label}
          </p>
          <p className="font-display text-lg text-on-surface leading-tight truncate">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function ReplayCardItem({ replay, index }: { replay: ReplayCard; index: number }) {
  const navigate = useNavigate();
  const userId = useAuthStore.getState().user?.id;
  const isMe = replay.winner_id === userId;

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'Check out my poker hand!',
          text: `I won a ${replay.hand_description} pot of $${replay.pot}! 🃏`,
          url: replay.share_url,
        })
        .catch(() => { });
    } else {
      navigator.clipboard
        .writeText(replay.share_url)
        .then(() => {
          toast.success('Link copied to clipboard!');
        })
        .catch(() => {
          toast.error('Failed to copy link');
        });
    }
  };

  return (
    <Card className="p-5 bg-gradient-to-br from-yellow-500/5 to-transparent border-white/10 backdrop-blur-xl rounded-2xl transition-all duration-300 hover:bg-white/[0.07] group relative overflow-hidden h-full flex flex-col">
      {/* Subtle glow accent */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col gap-4 h-full">
        {/* Top Section */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0 font-data-mono text-sm font-bold text-yellow-400">
              {String(index + 1).padStart(2, '0')}
            </div>
            <div className="min-w-0">
              <h3 className="font-headline-md text-base text-on-surface truncate flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                {replay.hand_description}
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                Won by <span className="text-on-surface font-medium">{isMe ? 'You' : replay.winner_name}</span>
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10 font-mono text-[10px] flex-shrink-0">
            ${replay.pot.toLocaleString()}
          </Badge>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(replay.played_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span className="flex items-center gap-1">
            <Table className="w-3 h-3" />
            <span className="font-data-mono text-on-surface-variant/80">
              {replay.table_id.slice(0, 6)}
            </span>
          </span>
        </div>

        {/* Cards Display */}
        <div className="flex flex-col gap-2 mt-1 flex-1">
          {replay.winner_cards && replay.winner_cards.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-data-mono uppercase tracking-wider text-on-surface-variant w-14">
                Hole
              </span>
              <div className="flex gap-1.5">
                {replay.winner_cards.map((card, idx) => (
                  <span
                    key={idx}
                    className="w-8 h-10 flex items-center justify-center bg-white rounded-[4px] shadow-sm border border-black/10"
                  >
                    {formatCard(card)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {replay.community_cards && replay.community_cards.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-data-mono uppercase tracking-wider text-on-surface-variant w-14">
                Board
              </span>
              <div className="flex gap-1.5">
                {replay.community_cards.map((card, idx) => (
                  <span
                    key={idx}
                    className="w-8 h-10 flex items-center justify-center bg-white rounded-[4px] shadow-sm border border-black/10"
                  >
                    {formatCard(card)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({
                to: '/table/$tableId',
                params: { tableId: replay.table_id },
                search: { handId: replay.id },
              })
            }
            className="flex-1 bg-white/5 border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/10 rounded-xl group/btn"
          >
            <Eye className="w-4 h-4 mr-1.5 transition-transform group-hover/btn:scale-110" />
            View Hand
            <ChevronRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="bg-white/5 border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/10 rounded-xl px-3"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReplaysSkeleton() {
  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="animate-pulse space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28 bg-white/5" />
          <Skeleton className="h-9 w-52 bg-white/5" />
          <Skeleton className="h-4 w-72 bg-white/5" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 bg-white/5 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-56 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
