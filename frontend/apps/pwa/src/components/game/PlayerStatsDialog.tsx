import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlayerStats } from '@/hooks/usePlayerStats';
import { cn } from '@/lib/utils';
import { Dialog } from '@stackbluff/shared/components/Dialog';
import { X, Trophy, Coins, Target, TrendingUp, BarChart3, Users, Zap, Award } from 'lucide-react';

interface PlayerStatsDialogProps {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

// Animation variants for staggered reveal
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function PlayerStatsDialog({ userId, onOpenChange }: PlayerStatsDialogProps) {
  const open = !!userId;
  const { data: stats, isLoading, isError } = usePlayerStats(userId);

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} className="max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-tertiary" />
            Player Statistics
          </h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            {stats?.display_name || (isLoading ? 'Loading...' : 'Player Profile')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Animated Content Container */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto dialog-scroll"
      >
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-full bg-white/5" />
            <Skeleton className="h-6 w-full bg-white/5" />
            <Skeleton className="h-6 w-full bg-white/5" />
            <Skeleton className="h-6 w-full bg-white/5" />
          </div>
        ) : isError || !stats ? (
          <motion.div variants={itemVariants} className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
            Failed to load stats. Please try again later.
          </motion.div>
        ) : stats.hands_played === 0 ? (
          <motion.div variants={itemVariants} className="text-center py-8 text-on-surface-variant text-sm">
            Player hasn't completed any hands yet.
          </motion.div>
        ) : (
          <>
            {/* Volume Section */}
            <motion.div variants={itemVariants} className="space-y-3">
              <h3 className="font-label-caps text-[10px] text-tertiary tracking-widest uppercase flex items-center gap-2">
                <Target className="w-3.5 h-3.5" />
                Volume
              </h3>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-on-surface-variant">Hands Played</span>
                <span className="text-on-surface">{stats.hands_played.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-on-surface-variant">Hands Won</span>
                <span className="text-on-surface">{stats.hands_won.toLocaleString()} ({formatPercent(stats.win_rate)})</span>
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-on-surface-variant">All-in Count</span>
                <span className="text-on-surface">{stats.all_in_count}</span>
              </div>
            </motion.div>

            {/* Preflop Aggression */}
            <motion.div variants={itemVariants} className="space-y-3">
              <h3 className="font-label-caps text-[10px] text-tertiary tracking-widest uppercase flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Preflop
              </h3>
              <div className="space-y-1">
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-on-surface-variant">VPIP</span>
                  <span className="text-tertiary">{formatPercent(stats.vpip)}</span>
                </div>
                <Progress value={stats.vpip * 100} indicatorClassName="bg-tertiary" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-on-surface-variant">PFR</span>
                  <span className="text-tertiary">{formatPercent(stats.pfr)}</span>
                </div>
                <Progress value={stats.pfr * 100} indicatorClassName="bg-tertiary" />
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-on-surface-variant">Aggression Factor</span>
                <span className="text-on-surface">{stats.aggression_factor.toFixed(2)}</span>
              </div>
            </motion.div>

            {/* Showdown */}
            <motion.div variants={itemVariants} className="space-y-3">
              <h3 className="font-label-caps text-[10px] text-tertiary tracking-widest uppercase flex items-center gap-2">
                <Award className="w-3.5 h-3.5" />
                Showdown
              </h3>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-on-surface-variant">Went to Showdown</span>
                <span className="text-on-surface">{formatPercent(stats.wtsd)}</span>
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-on-surface-variant">Won at Showdown</span>
                <span className="text-on-surface">
                  {stats.showdowns > 0 ? formatPercent(stats.showdown_wins / stats.showdowns) : '0%'}
                </span>
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-on-surface-variant">Total Showdowns</span>
                <span className="text-on-surface">{stats.showdowns}</span>
              </div>
            </motion.div>

            {/* Money */}
            <motion.div variants={itemVariants} className="space-y-3">
              <h3 className="font-label-caps text-[10px] text-tertiary tracking-widest uppercase flex items-center gap-2">
                <Coins className="w-3.5 h-3.5" />
                Money
              </h3>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-on-surface-variant">Net Profit</span>
                <span className={cn(stats.net_profit >= 0 ? 'text-tertiary' : 'text-red-400')}>
                  {stats.net_profit >= 0 ? '+' : ''}{formatCurrency(stats.net_profit)}
                </span>
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-on-surface-variant">Biggest Pot Won</span>
                <span className="text-on-surface">{formatCurrency(stats.biggest_pot_won)}</span>
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-on-surface-variant">Total Wagered</span>
                <span className="text-on-surface">{formatCurrency(stats.total_wagered)}</span>
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-on-surface-variant">Total Won</span>
                <span className="text-on-surface">{formatCurrency(stats.total_won)}</span>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/5 flex gap-3 shrink-0">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onOpenChange(false)}
          className="flex-1 py-2.5 rounded-lg border border-white/10 text-on-surface-variant text-[11px] font-label-caps uppercase tracking-wider hover:bg-white/5 transition-all"
        >
          Close
        </motion.button>
      </div>
    </Dialog>
  );
}
