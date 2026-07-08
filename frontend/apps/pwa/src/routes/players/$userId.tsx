import { createFileRoute, useNavigate, Link, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared/api/client';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useUserBadges } from '@/hooks/useBadges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Coins, Award, Crown, TrendingUp, Target, Users, ArrowLeft } from 'lucide-react';
import type { PlayerStats } from '@/types/player-stats';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/players/$userId')({
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const navigate = useNavigate();
  const params = useParams({ from: '/players/$userId' });
  const userId = params.userId;
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isOwnProfile = userId === currentUserId;

  // Fetch player stats
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<PlayerStats>({
    queryKey: ['player-stats', userId],
    queryFn: () => apiClient<PlayerStats>(`/players/${userId}/stats`),
    enabled: !!userId,
    staleTime: 30_000,
  });

  // Fetch badges for this user
  const { data: badges, isLoading: badgesLoading } = useUserBadges(userId);

  // Fetch username (maybe we can get from stats or from a separate call)
  // For now, we'll use stats.display_name if available, else fallback.
  const displayName = stats?.display_name || `Player ${userId.slice(0, 8)}`;
  const avatarUrl = undefined; // not yet available from API

  if (statsLoading || badgesLoading) {
    return <PublicProfileSkeleton />;
  }

  if (statsError || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Player Not Found</h2>
          <p className="text-on-surface-variant text-sm">
            The player you're looking for does not exist or has not played any hands yet.
          </p>
          <button
            onClick={() => navigate({ to: '/' })}
            className="mt-4 px-6 py-2 bg-tertiary text-on-tertiary rounded-lg"
          >
            Go Home
          </button>
        </Card>
      </div>
    );
  }

  const handsPlayed = stats.hands_played || 0;
  const winRate = stats.win_rate ?? 0;
  const vpip = stats.vpip ?? 0;
  const pfr = stats.pfr ?? 0;
  const aggressionFactor = stats.aggression_factor ?? 0;
  const netProfit = stats.net_profit ?? 0;
  const biggestPot = stats.biggest_pot_won ?? 0;
  const allInCount = stats.all_in_count ?? 0;
  const showdowns = stats.showdowns ?? 0;
  const showdownWins = stats.showdown_wins ?? 0;

  const hasFoundingMember = badges?.some((b) => b.badge_type === 'founding_member');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate({ to: '/' })}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        <Avatar className="w-24 h-24 border-2 border-tertiary/30">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-surface-container text-3xl text-on-surface">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-on-surface">{displayName}</h1>
            {hasFoundingMember && (
              <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                <Crown className="w-3 h-3 mr-1" />
                Founding Member
              </Badge>
            )}
            {isOwnProfile && (
              <Badge variant="outline" className="border-tertiary/30 text-tertiary">You</Badge>
            )}
            {/* Rank badge – placeholder */}
            <Badge variant="outline" className="border-tertiary/30 text-tertiary">
              <Trophy className="w-3 h-3 mr-1" />
              Silver
            </Badge>
          </div>
          <p className="text-on-surface-variant text-sm mt-1">Player since {new Date().toLocaleDateString()}</p>
          <div className="flex flex-wrap gap-4 mt-3">
            <div className="flex items-center gap-1 text-sm text-on-surface-variant">
              <Users className="w-4 h-4" />
              <span>{handsPlayed} hands</span>
            </div>
          </div>
        </div>
        {isOwnProfile && (
          <button
            onClick={() => navigate({ to: '/profile' })}
            className="px-4 py-2 bg-tertiary text-on-tertiary rounded-lg text-sm"
          >
            View Full Profile
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Badges */}
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
            <p className="text-sm text-on-surface-variant">No badges yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Reuse stat components from profile page
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

function PublicProfileSkeleton() {
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
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
