import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Trophy, Medal, Calendar, TrendingUp, Crown, Sparkles, ChevronRight, User } from 'lucide-react';
import {useState, useEffect} from "react";
import { trackGameEvent } from '@/lib/customAnalytics';

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
});

type Period = 'global' | 'weekly' | 'monthly';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
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

function LeaderboardPage() {
  const navigate = useNavigate();
  const { data: entries, isLoading, error } = useLeaderboard();
  const currentUser = useAuthStore((s) => s.user);
  const [period, setPeriod] = useState<Period>('global');


  // Track leaderboard view when data is loaded
  useEffect(() => {
    if (!isLoading && entries && entries.length > 0) {
      trackGameEvent('leaderboard_view', {
        period: period,
        total_entries: entries.length,
      });
    }
  }, [isLoading, entries, period]);


    if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] text-red-400">
        Failed to load leaderboard: {(error as Error).message}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] text-on-surface-variant">
        No leaderboard data available yet.
      </div>
    );
  }

  const displayEntries = entries;
  const topThree = displayEntries.slice(0, 3);
  const rest = displayEntries.slice(3);
  const userRank = displayEntries.findIndex((e) => e.user_id === currentUser?.id) + 1;
  const currentUserEntry = displayEntries.find((e) => e.user_id === currentUser?.id);

  const periodLabels: Record<Period, { label: string; icon: React.ReactNode }> = {
    global: { label: 'All Time', icon: <Trophy className="w-4 h-4" /> },
    weekly: { label: 'This Week', icon: <Calendar className="w-4 h-4" /> },
    monthly: { label: 'This Month', icon: <TrendingUp className="w-4 h-4" /> },
  };

  // Podium logic: 2nd, 1st, 3rd
  const podiumOrder = topThree.length === 3 ? [topThree[1], topThree[0], topThree[2]] : topThree;
  const podiumStyles = [
    {
      height: 'h-36',
      color: 'text-slate-300',
      bg: 'bg-slate-400/10',
      border: 'border-slate-400/30',
      icon: <Medal className="w-6 h-6" />
    },
    {
      height: 'h-48',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/40',
      icon: <Crown className="w-7 h-7" />
    },
    {
      height: 'h-28',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      icon: <Medal className="w-6 h-6" />
    },
  ];

  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 pb-32 space-y-8">
      {/* Ambient Background Lighting */}
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
            Top Players
          </span>
        </div>
        <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface">
          Leaderboard
        </h1>
        <p className="text-on-surface-variant text-sm mt-1 max-w-md">
          Compete globally and climb the ranks to earn exclusive rewards.
        </p>
      </motion.div>

      {/* Period Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex gap-1.5 p-1.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl w-fit"
      >
        {(Object.keys(periodLabels) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300',
              period === p
                ? 'bg-gradient-to-r from-tertiary to-emerald-400 text-on-tertiary shadow-lg shadow-tertiary/20'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
            )}
          >
            {periodLabels[p].icon}
            {periodLabels[p].label}
          </button>
        ))}
      </motion.div>

      {/* Podium */}
      <div className="flex justify-center items-end gap-3 md:gap-6 py-8">
        {podiumOrder.map((entry, idx) => {
          const actualRank = topThree.indexOf(entry) + 1;
          const style = podiumStyles[idx];
          const isCurrentUser = entry.user_id === currentUser?.id;

          return (
            <motion.div
              key={entry.user_id}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.15, type: "spring", stiffness: 200, damping: 20 }}
              className="flex flex-col items-center w-24 md:w-32"
              onClick={() => navigate({ to: '/players/$userId', params: { userId: entry.user_id } })}
            >
              {/* Avatar */}
              <div className="relative mb-3">
                <div className={cn(
                  "w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl font-bold border-2 transition-transform hover:scale-105 cursor-pointer",
                  style.bg, style.color, style.border
                )}>
                  {entry.display_name.charAt(0).toUpperCase()}
                </div>
                <div className={cn(
                  "absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center bg-surface border-2",
                  style.border, style.color
                )}>
                  {style.icon}
                </div>
              </div>

              {/* Info */}
              <span className="text-sm font-medium text-on-surface mb-1 truncate max-w-full text-center">
                {entry.display_name}
              </span>
              <span className="text-xs font-data-mono text-on-surface-variant mb-3">
                ${(entry.total_chips_won || 0).toLocaleString()}
              </span>

              {/* Podium Block */}
              <div className={cn(
                "w-full rounded-t-xl border-t-2 backdrop-blur-xl flex items-start justify-center pt-3 transition-colors cursor-pointer",
                style.height, style.bg, style.border,
                "bg-white/5 hover:bg-white/10",
                isCurrentUser && "ring-2 ring-tertiary ring-offset-2 ring-offset-surface"
              )}>
                <span className={cn("text-2xl font-bold font-data-mono", style.color)}>
                  {actualRank}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Full list */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-xl p-2"
      >
        {rest.map((entry, index) => {
          const rank = index + 4;
          const isCurrentUser = entry.user_id === currentUser?.id;

          return (
            <motion.div
              key={entry.user_id}
              variants={itemVariants}
              onClick={() => navigate({ to: '/players/$userId', params: { userId: entry.user_id } })}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl transition-colors cursor-pointer group",
                isCurrentUser ? "bg-tertiary/10 hover:bg-tertiary/15" : "hover:bg-white/[0.07]"
              )}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-8 text-center font-data-mono text-sm text-on-surface-variant font-bold">
                  {rank}
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-on-surface-variant flex-shrink-0">
                  {entry.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-on-surface flex items-center gap-2">
                    {entry.display_name}
                    {isCurrentUser && (
                      <span className="text-[10px] font-data-mono uppercase tracking-wider text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-full border border-tertiary/20">
                        You
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <span className="text-sm font-data-mono font-bold text-tertiary">
                  ${(entry.total_chips_won || 0).toLocaleString()}
                </span>
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Your rank sticky bar */}
      {userRank > 0 && userRank > 3 && currentUserEntry && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 25 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-md"
        >
          <Link
            to="/profile"
            className="bg-surface/90 backdrop-blur-xl border border-tertiary/30 rounded-2xl px-6 py-4 shadow-2xl shadow-black/50 flex items-center justify-between gap-4 hover:border-tertiary/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-tertiary/10 border border-tertiary/30 flex items-center justify-center text-tertiary font-bold text-sm">
                {userRank}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-medium">Your Rank</p>
                <p className="text-sm font-medium text-on-surface truncate">{currentUserEntry.display_name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-medium">Chips Won</p>
              <p className="text-sm font-data-mono font-bold text-tertiary">
                ${(currentUserEntry.total_chips_won || 0).toLocaleString()}
              </p>
            </div>
          </Link>
        </motion.div>
      )}
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 pb-32 space-y-8 animate-pulse">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      <div className="space-y-2">
        <Skeleton className="h-4 w-32 bg-white/5" />
        <Skeleton className="h-8 w-48 bg-white/5" />
        <Skeleton className="h-4 w-64 bg-white/5" />
      </div>

      <div className="flex gap-1.5 p-1.5 bg-white/5 rounded-2xl w-fit">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-28 bg-white/5 rounded-xl" />
        ))}
      </div>

      <div className="flex justify-center items-end gap-6 py-8">
        <Skeleton className="w-32 h-36 bg-white/5 rounded-t-xl" />
        <Skeleton className="w-32 h-48 bg-white/5 rounded-t-xl" />
        <Skeleton className="w-32 h-28 bg-white/5 rounded-t-xl" />
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-2 space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full bg-white/5 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
