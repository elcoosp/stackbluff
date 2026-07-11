import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Trophy,
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
  Link2,
  Check,
  X,
  MoreHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';
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

interface TableInfo {
  table_id: string;
  name: string;
  stake_level: string;
  max_players: number;
  current_players: number;
  status: string;
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

// Custom Brand SVG Icons
const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" {...props}>
    <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
  </svg>
);

const RedditIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" {...props}>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.498.268-.27.643-.438 1.064-.438.835 0 1.512.677 1.512 1.512 0 .609-.36 1.13-.878 1.368.042.165.063.336.063.514 0 2.495-2.806 4.518-6.267 4.518s-6.267-2.023-6.267-4.518c0-.18.021-.35.063-.514A1.511 1.511 0 0 1 5.248 12c0-.835.677-1.512 1.512-1.512.42 0 .795.168 1.064.438 1.194-.866 2.85-1.428 4.674-1.498l.878-4.118a.497.497 0 0 1 .205-.313.497.497 0 0 1 .378-.086l3.117.654a1.25 1.25 0 0 1 1.165-.79Zm-8.506 9.014a1.25 1.25 0 1 0 2.498 0 1.25 1.25 0 0 0-2.498 0Zm4.996 0a1.25 1.25 0 1 0 2.498 0 1.25 1.25 0 0 0-2.498 0Zm-2.498 3.74a.625.625 0 0 0 0 1.25c1.516 0 2.873-.476 3.844-1.252a.625.625 0 1 0-.81-.95c-.713.604-1.793.998-3.034.998a.625.625 0 0 0 0-.996Z" />
  </svg>
);

const TelegramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" {...props}>
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0Zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635Z" />
  </svg>
);

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

  // Fetch lobby tables to map table_id to table_name
  // Using try/catch inside queryFn to gracefully handle failures without crashing the page
  const { data: tablesData } = useQuery<TableInfo[]>({
    queryKey: ['lobby-tables'],
    queryFn: async () => {
      try {
        return await apiClient<TableInfo[]>('/lobby');
      } catch (err) {
        // If the endpoint fails, return an empty array to avoid unhandled errors
        return [];
      }
    },
    enabled: isAuthenticated,
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
              <ReplayCardItem replay={replay} index={idx} tableMap={tableMap} />
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

function ReplayCardItem({
  replay,
  index,
  tableMap
}: {
  replay: ReplayCard;
  index: number;
  tableMap: Map<string, string>;
}) {
  const navigate = useNavigate();
  const userId = useAuthStore.getState().user?.id;
  const isMe = replay.winner_id === userId;

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareText = `I won a ${replay.hand_description} pot of $${replay.pot} on Stackbluff Poker! 🃏`;

  // Ensure the URL is absolute (prepend domain if backend sends a relative path)
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const rawUrl = replay.share_url || `/hands/${replay.id}`;
  const shareUrl = rawUrl.startsWith('http') ? rawUrl : `${origin}${rawUrl}`;

  const socials = [
    { name: 'Twitter', Icon: XIcon, url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
    { name: 'Facebook', Icon: FacebookIcon, url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    { name: 'Reddit', Icon: RedditIcon, url: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}` },
    { name: 'Telegram', Icon: TelegramIcon, url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
  ];

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error('Failed to copy link'));
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Check out my poker hand!',
        text: shareText,
        url: shareUrl,
      }).catch(() => { });
    } else {
      handleCopyLink();
    }
  };

  // Fallback to ID slice if the table name isn't fetched or found
  const tableName = tableMap.get(replay.table_id) || `Table ${replay.table_id.slice(0, 6)}`;

  return (
    <>
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
                {tableName}
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
                  to: '/hands/$handId',
                  params: { handId: replay.id },
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
              onClick={() => setIsShareOpen(true)}
              className="bg-white/5 border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/10 rounded-xl px-3"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Share Modal */}
      <AnimatePresence>
        {isShareOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsShareOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setIsShareOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="font-display-lg text-xl text-on-surface mb-1">Share Your Hand</h3>
              <p className="text-on-surface-variant text-sm mb-5">
                Show off your {replay.hand_description} to the world!
              </p>

              {/* Socials Grid */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {socials.map(({ name, Icon, url }) => (
                  <a
                    key={name}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
                  >
                    <Icon className="w-5 h-5 text-on-surface-variant group-hover:text-on-surface transition-colors" />
                    <span className="text-[10px] font-data-mono text-on-surface-variant group-hover:text-on-surface transition-colors">
                      {name}
                    </span>
                  </a>
                ))}
              </div>

              {/* Copy Link Input */}
              <div className="flex items-center gap-2 p-1 pl-3 bg-black/30 border border-white/10 rounded-xl mb-3">
                <Link2 className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-sm text-on-surface-variant font-mono outline-none truncate"
                />
                <Button
                  size="sm"
                  onClick={handleCopyLink}
                  className={cn(
                    "rounded-lg px-3",
                    copied ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-tertiary text-black hover:bg-tertiary/90"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" /> Copied
                    </>
                  ) : (
                    "Copy"
                  )}
                </Button>
              </div>

              {/* Native Share Fallback */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNativeShare}
                className="w-full text-on-surface-variant hover:text-on-surface hover:bg-white/5"
              >
                <MoreHorizontal className="w-4 h-4 mr-2" />
                More Options
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
