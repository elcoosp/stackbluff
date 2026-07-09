import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { apiClient } from '@stackbluff/shared/api/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import { ErrorState } from '@/components/ui/ErrorState';
import {
  Users,
  Gift,
  Copy,
  Share2,
  CheckCircle,
  TrendingUp,
  Award,
  Crown,
  Link as LinkIcon,
  X,
  Send,
  MessageCircle
} from 'lucide-react';

export const Route = createFileRoute('/referrals')({
  component: ReferralsPage,
});

interface ReferralStats {
  total_referred: number;
  bonus_earned: number;
  pending_bonus: number;
}

interface ReferralRecord {
  referred_id: string;
  display_name?: string;
  hand_count: number;
  bonus_awarded: boolean;
  created_at: string;
}

function ReferralsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();

  // Fetch referral stats
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<ReferralStats>({
    queryKey: ['referrals', 'stats'],
    queryFn: () => apiClient<ReferralStats>('/referrals/stats'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  // Fetch referred users
  const { data: referrals, isLoading: referralsLoading, error: referralsError } = useQuery<ReferralRecord[]>({
    queryKey: ['referrals', 'list'],
    queryFn: () => apiClient<ReferralRecord[]>('/referrals/list'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  // Generate referral link
  const referralLink = user?.id ? `${window.location.origin}/register?ref=${user.id}` : '';

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(referralLink).then(() => {
        toast.success('Referral link copied!');
      }).catch(() => {
        toast.error('Failed to copy link');
      });
    } else {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = referralLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success('Referral link copied!');
    }
  };

  const handleShare = (platform: string) => {
    const text = `Join me on StackBluff! Use my referral link: ${referralLink}`;
    const url = encodeURIComponent(referralLink);
    const textEncoded = encodeURIComponent(text);
    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${textEncoded}`;
        break;
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${url}&text=${textEncoded}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${textEncoded}`;
        break;
      default:
        return;
    }
    window.open(shareUrl, '_blank');
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Sign In Required</h2>
          <p className="text-on-surface-variant text-sm">Please sign in to view your referral dashboard.</p>
          <Link to="/login" className="mt-4 inline-block">
            <Button>Sign In</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isLoading = statsLoading || referralsLoading;

  if (isLoading) {
    return <ReferralsSkeleton />;
  }

  if (statsError || referralsError || !stats) {
    return <ErrorState onRetry={() => window.location.reload()} message="Failed to load referral data." />;
  }

  const { total_referred, bonus_earned, pending_bonus } = stats;
  const hasFoundingMember = bonus_earned >= 10;
  const progressToFounding = Math.min((bonus_earned / 10) * 100, 100);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="font-display-lg text-3xl text-on-surface flex items-center gap-2">
          <Users className="w-8 h-8 text-tertiary" />
          Referrals
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Invite friends to StackBluff and earn rewards.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="text-on-surface-variant text-xs">Total Referrals</div>
            <div className="text-2xl font-bold text-on-surface mt-1">{total_referred}</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="text-on-surface-variant text-xs">Bonus Earned</div>
            <div className="text-2xl font-bold text-tertiary mt-1">${bonus_earned * 100}</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="text-on-surface-variant text-xs">Pending Bonus</div>
            <div className="text-2xl font-bold text-yellow-400 mt-1">${pending_bonus * 100}</div>
          </CardContent>
        </Card>
      </div>

      {/* Founding Member Progress */}
      <Card className="p-4 bg-white/5 border-white/10">
        <div className="flex items-start gap-4">
          <Crown className={cn(
            'w-8 h-8 flex-shrink-0',
            hasFoundingMember ? 'text-yellow-400' : 'text-on-surface-variant/30'
          )} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-on-surface">Founding Member</h3>
              {hasFoundingMember ? (
                <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Unlocked!
                </Badge>
              ) : (
                <Badge variant="outline" className="border-white/20 text-on-surface-variant">
                  {10 - bonus_earned} referrals needed
                </Badge>
              )}
            </div>
            <p className="text-sm text-on-surface-variant mt-1">
              Refer 10 friends who play at least 5 hands to earn the Founding Member badge.
            </p>
            <div className="mt-2">
              <Progress value={progressToFounding} className="h-2" indicatorClassName="bg-yellow-400" />
              <div className="flex justify-between text-xs text-on-surface-variant mt-1">
                <span>{bonus_earned} / 10</span>
                <span>{Math.round(progressToFounding)}%</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Referral Link */}
      <Card className="p-4 bg-white/5 border-white/10">
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-on-surface-variant">Your referral link</p>
            <div className="flex items-center gap-2 mt-1 bg-black/30 rounded-lg px-3 py-2">
              <LinkIcon className="w-4 h-4 text-on-surface-variant/50 flex-shrink-0" />
              <span className="text-sm text-on-surface truncate">{referralLink}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 self-end">
            <Button onClick={handleCopyLink} variant="outline" size="sm" className="border-white/10"> aria-label="Copy referral link"
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>
            <Button onClick={() => handleShare('twitter')} variant="outline" size="sm" className="border-white/10"> aria-label="Share on X (Twitter)"
              <X className="w-4 h-4" />
            </Button>
            <Button onClick={() => handleShare('telegram')} variant="outline" size="sm" className="border-white/10"> aria-label="Share on Telegram"
              <Send className="w-4 h-4" />
            </Button>
            <Button onClick={() => handleShare('whatsapp')} variant="outline" size="sm" className="border-white/10"> aria-label="Share on WhatsApp"
              <MessageCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Referred Friends List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <Users className="w-4 h-4 text-tertiary" />
            Referred Friends
          </CardTitle>
        </CardHeader>
        <CardContent>
          {referrals && referrals.length > 0 ? (
            <div className="space-y-2">
              {referrals.map((ref) => (
                <div key={ref.referred_id} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                  <div>
                    <span className="text-sm text-on-surface">
                      {ref.display_name || `Player ${ref.referred_id.slice(0, 8)}`}
                    </span>
                    <span className="text-xs text-on-surface-variant ml-2">
                      {ref.hand_count} hands
                    </span>
                  </div>
                  {ref.bonus_awarded ? (
                    <span className="text-xs text-tertiary font-medium">✓ Bonus awarded</span>
                  ) : ref.hand_count >= 5 ? (
                    <span className="text-xs text-yellow-400">Pending bonus</span>
                  ) : (
                    <span className="text-xs text-on-surface-variant/50">
                      {5 - ref.hand_count} more hands
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant text-center py-4">
              No referrals yet. Share your link and invite friends!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReferralsSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-pulse">
      <div>
        <Skeleton className="h-8 w-48 bg-white/5" />
        <Skeleton className="h-4 w-64 bg-white/5 mt-1" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 bg-white/5 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 bg-white/5 rounded-xl" />
      <Skeleton className="h-24 bg-white/5 rounded-xl" />
      <Skeleton className="h-48 bg-white/5 rounded-xl" />
    </div>
  );
}
