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
} from 'lucide-react';
import type { PlayerStats } from '@/types/player-stats';

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { data: badges, isLoading: badgesLoading } = useBadges();

  // Fetch player stats (always called)
  const { data: stats, isLoading: statsLoading } = useQuery<PlayerStats>({
    queryKey: ['player-stats', user?.id],
    queryFn: () => apiClient<PlayerStats>(`/players/${user?.id}/stats`),
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const isLoading = badgesLoading || statsLoading;
  const balance = useAuthStore((s) => s.balance);

  // If not authenticated, show sign-in screen (no early return)
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Sign In Required</h2>
          <p className="text-on-surface-variant text-sm">Please sign in to view your profile.</p>
          <button
            onClick={() => navigate({ to: '/login' })}
            className="mt-4 px-6 py-2 bg-tertiary text-on-tertiary rounded-lg"
          >
            Sign In
          </button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  // Use available user fields; fallback to defaults
  const displayName = user?.username || 'Player';// Stats
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* Single Avatar with upload capability */}
        <AvatarUpload onAvatarUpdated={() => window.location.reload()} />

        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-on-surface">{displayName}</h1>
            {hasFoundingMember && (
              <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                <Crown className="w-3 h-3 mr-1" />
                Founding Member
              </Badge>
            )}
            <Badge variant="outline" className="border-tertiary/30 text-tertiary">
              <Trophy className="w-3 h-3 mr-1" />
              Silver
            </Badge>
          </div>
          <p className="text-on-surface-variant text-sm mt-1">Member since {new Date().toLocaleDateString()}</p>
          <div className="flex flex-wrap gap-4 mt-3">
            <div className="flex items-center gap-1 text-sm text-on-surface-variant">
              <Coins className="w-4 h-4 text-tertiary" />
              <span className="font-mono">${balance.toLocaleString()}</span>
              <span className="text-xs">chips</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate({ to: '/settings' })}
          className="px-4 py-2 border border-white/10 rounded-lg text-sm text-on-surface-variant hover:bg-white/5 transition-colors"
        >
          Edit Profile
        </button>
      </div>

      {/* Quick links with icons */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 border-t border-white/10 pt-4">
        <Link to="/history" className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-tertiary transition-colors">
          <History className="w-4 h-4" />
          Hand History
        </Link>
        <Link to="/replays" className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-tertiary transition-colors">
          <Film className="w-4 h-4" />
          Replays
        </Link>
        <Link to="/missions" className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-tertiary transition-colors">
          <Target className="w-4 h-4" />
          Missions
        </Link>
        <Link to="/referrals" className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-tertiary transition-colors">
          <Users className="w-4 h-4" />
          Referrals
        </Link>
        <Link to="/clubs" className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-tertiary transition-colors">
          <Building2 className="w-4 h-4" />
          Clubs
        </Link>
        <Link to="/settings" className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-tertiary transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Hands Played" value={handsPlayed} icon={<Target className="w-4 h-4" />} />
        <StatCard label="Win Rate" value={`${(winRate * 100).toFixed(1)}%`} icon={<TrendingUp className="w-4 h-4" />} />
        <StatCard label="Net Profit" value={`$${netProfit.toLocaleString()}`} icon={<Coins className="w-4 h-4" />} />
        <StatCard label="Biggest Pot" value={`$${biggestPot.toLocaleString()}`} icon={<Award className="w-4 h-4" />} />
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface">Preflop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatRow label="VPIP" value={`${(vpip * 100).toFixed(1)}%`} />
            <StatRow label="PFR" value={`${(pfr * 100).toFixed(1)}%`} />
            <StatRow label="Aggression Factor" value={aggressionFactor.toFixed(2)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface">Showdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatRow label="Showdowns" value={showdowns.toString()} />
            <StatRow label="Showdown Wins" value={showdownWins.toString()} />
            <StatRow label="Showdown Win %" value={showdowns > 0 ? `${((showdownWins / showdowns) * 100).toFixed(1)}%` : '0%'} />
            <StatRow label="All-Ins" value={allInCount.toString()} />
          </CardContent>
        </Card>
      </div>

      {/* Badges Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-400" />
            Badges
          </CardTitle>
        </CardHeader>
        <CardContent>
          {badges && badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <Badge key={b.badge_type} variant="default" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  {b.badge_type === 'founding_member' && <Crown className="w-3 h-3 mr-1" />}
                  {b.badge_type.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">No badges yet. Keep playing to earn them!</p>
          )}
        </CardContent>
      </Card>

      {/* Season Cards Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <Calendar className="w-4 h-4 text-tertiary" />
            Season Cards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SeasonCardDisplay />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-on-surface-variant text-xs">{icon} {label}</div>
        <div className="text-xl font-bold text-on-surface mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-on-surface font-mono">{value}</span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-pulse">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        <Skeleton className="w-24 h-24 rounded-full bg-white/5" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-48 bg-white/5" />
          <Skeleton className="h-4 w-32 bg-white/5" />
          <div className="flex gap-4">
            <Skeleton className="h-6 w-20 bg-white/5" />
            <Skeleton className="h-6 w-20 bg-white/5" />
          </div>
        </div>
        <Skeleton className="h-10 w-24 bg-white/5 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 bg-white/5 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-40 bg-white/5 rounded-xl" />
        <Skeleton className="h-40 bg-white/5 rounded-xl" />
      </div>
      <Skeleton className="h-32 bg-white/5 rounded-xl" />
    </div>
  );
}
