import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useBadges } from '@/hooks/useBadges';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AvatarUpload } from '@/components/settings/AvatarUpload';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { SeasonCardDisplay } from '@/components/profile/SeasonCardDisplay';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Coins,
  Calendar,
  Award,
  Crown,
  TrendingUp,
  Target,
  History,
  Film,
  Users,
  Building2,
  Settings,
  Sparkles,
  Edit,
  Flame,
  Swords,
  Gem,
} from 'lucide-react';
import type { PlayerStats } from '@/types/player-stats';
import { requireAuth } from '@/lib/authGuard';

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
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

function ProfilePage() {
  const navigate = useNavigate();
  const {user} = useAuthStore();
  const { data: badges, isLoading: badgesLoading } = useBadges();

  const { data: stats, isLoading: statsLoading } = useQuery<PlayerStats>({
    queryKey: ['player-stats', user?.id],
    queryFn: () => apiClient<PlayerStats>(`/players/${user?.id}/stats`),
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const isLoading = badgesLoading || statsLoading;
  const balance = useAuthStore((s) => s.balance);


  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const displayName = user?.username || 'Player';
  const handsPlayed = stats?.hands_played || 0;
  const winRate = stats?.win_rate ?? 0;
  const vpip = stats?.vpip ?? 0;
  const pfr = stats?.pfr ?? 0;
  const aggressionFactor = stats?.aggression_factor ?? 0;
  const netProfit = stats?.net_profit ?? 0;
  const biggestPot = stats?.biggest_pot_won ?? 0;
  const allInCount = stats?.all_in_count ?? 0;
  const showdowns = stats?.showdowns ?? 0;
  const showdownWins = stats?.showdown_wins ?? 0;

  const hasFoundingMember = badges?.some((b) => b.badge_type === 'founding_member');

  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        {/* Profile Header Card */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-tertiary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
              <AvatarUpload onAvatarUpdated={() => window.location.reload()} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-tertiary" />
                  <span className="text-xs font-data-mono uppercase tracking-widest text-tertiary">Player Profile</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="font-display-lg text-3xl text-on-surface">{displayName}</h1>
                  {hasFoundingMember && (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 font-mono">
                      <Crown className="w-3 h-3 mr-1" />
                      Founding Member
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-mono">
                    <Trophy className="w-3 h-3 mr-1" />
                    Silver
                  </Badge>
                </div>
                <p className="text-on-surface-variant text-sm mt-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Member since {new Date().toLocaleDateString()}
                </p>
                <div className="flex flex-wrap gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-sm font-data-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span className="text-on-surface font-bold">{balance.toLocaleString()}</span>
                    <span className="text-on-surface-variant text-xs">chips</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => navigate({ to: '/settings' })}
                variant="outline"
                className="bg-white/5 border-white/10 hover:bg-white/10 rounded-xl px-4 py-2 text-sm"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
          {[
            { to: '/history', icon: History, label: 'History' },
            { to: '/replays', icon: Film, label: 'Replays' },
            { to: '/missions', icon: Target, label: 'Missions' },
            { to: '/referrals', icon: Users, label: 'Referrals' },
            { to: '/clubs', icon: Building2, label: 'Clubs' },
            { to: '/settings', icon: Settings, label: 'Settings' },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Hands Played" value={handsPlayed.toLocaleString()} icon={<Target className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/10" variants={itemVariants} />
          <StatCard label="Win Rate" value={`${(winRate * 100).toFixed(1)}%`} icon={<TrendingUp className="w-4 h-4" />} color="text-tertiary" bg="bg-tertiary/10" variants={itemVariants} />
          <StatCard label="Net Profit" value={`${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString()}`} icon={<Coins className="w-4 h-4" />} color="text-yellow-400" bg="bg-yellow-500/10" variants={itemVariants} />
          <StatCard label="Biggest Pot" value={biggestPot.toLocaleString()} icon={<Gem className="w-4 h-4" />} color="text-purple-400" bg="bg-purple-500/10" variants={itemVariants} />
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div variants={itemVariants}>
            <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl shadow-xl h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Target className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="font-headline-md text-base text-on-surface">Preflop Aggression</h3>
              </div>
              <div className="space-y-4">
                <StatBar label="VPIP" value={`${(vpip * 100).toFixed(1)}%`} percentage={vpip * 100} />
                <StatBar label="PFR" value={`${(pfr * 100).toFixed(1)}%`} percentage={pfr * 100} />
                <StatRow label="Aggression Factor" value={aggressionFactor.toFixed(2)} />
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl shadow-xl h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                  <Swords className="w-4 h-4 text-purple-400" />
                </div>
                <h3 className="font-headline-md text-base text-on-surface">Showdowns</h3>
              </div>
              <div className="space-y-4">
                <StatBar label="Showdown Win Rate" value={showdowns > 0 ? `${((showdownWins / showdowns) * 100).toFixed(1)}%` : '0%'} percentage={showdowns > 0 ? (showdownWins / showdowns) * 100 : 0} />
                <StatRow label="Total Showdowns" value={showdowns.toString()} />
                <StatRow label="All-Ins" value={allInCount.toString()} />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Badges Section */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                <Award className="w-4 h-4 text-yellow-400" />
              </div>
              <h3 className="font-headline-md text-base text-on-surface">Badges</h3>
            </div>
            {badges && badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <Badge key={b.badge_type} variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 font-mono py-1.5 px-3 text-xs">
                    {b.badge_type === 'founding_member' && <Crown className="w-3 h-3 mr-1.5" />}
                    {b.badge_type.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant text-center py-4 opacity-80">No badges yet. Keep playing to earn them!</p>
            )}
          </Card>
        </motion.div>

        {/* Season Cards Section */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-tertiary/10 flex items-center justify-center border border-tertiary/20">
                <Calendar className="w-4 h-4 text-tertiary" />
              </div>
              <h3 className="font-headline-md text-base text-on-surface">Season Cards</h3>
            </div>
            <SeasonCardDisplay />
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, icon, color, bg, variants }: { label: string; value: string | number; icon: React.ReactNode; color: string; bg: string; variants: any }) {
  return (
    <motion.div variants={variants}>
      <Card className="p-5 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl shadow-xl h-full hover:bg-white/[0.07] transition-colors">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center mb-3 border border-white/10", bg, color)}>
          {icon}
        </div>
        <div className="text-2xl font-bold font-data-mono text-on-surface truncate">{value}</div>
        <p className="text-xs text-on-surface-variant mt-1 uppercase tracking-wider font-medium">{label}</p>
      </Card>
    </motion.div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm items-center">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-on-surface font-data-mono font-bold bg-black/20 px-2 py-0.5 rounded-md border border-white/5">{value}</span>
    </div>
  );
}

function StatBar({ label, value, percentage }: { label: string; value: string; percentage: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-on-surface-variant">{label}</span>
        <span className="text-on-surface font-data-mono font-bold">{value}</span>
      </div>
      <div className="relative w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-tertiary to-emerald-400 rounded-full"
        />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-pulse">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      <Skeleton className="h-40 bg-white/5 rounded-2xl" />

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-10 w-24 bg-white/5 rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 bg-white/5 rounded-2xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-48 bg-white/5 rounded-2xl" />
        <Skeleton className="h-48 bg-white/5 rounded-2xl" />
      </div>

      <Skeleton className="h-32 bg-white/5 rounded-2xl" />
      <Skeleton className="h-48 bg-white/5 rounded-2xl" />
    </div>
  );
}
