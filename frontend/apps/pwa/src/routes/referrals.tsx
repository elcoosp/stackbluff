import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { apiClient } from '@stackbluff/shared/api/client';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  Coins,
  Copy,
  Crown,
  Link as LinkIcon,
  MessageCircle,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
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

function ReferralsPage() {
  const _navigate = useNavigate();
  const _queryClient = useQueryClient();
  const { user } = useAuthStore();

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<ReferralStats>({
    queryKey: ['referrals', 'stats'],
    queryFn: () => apiClient<ReferralStats>('/referrals/stats'),
    enabled: true,
    staleTime: 60_000,
  });

  const {
    data: referrals,
    isLoading: referralsLoading,
    error: referralsError,
  } = useQuery<ReferralRecord[]>({
    queryKey: ['referrals', 'list'],
    queryFn: () => apiClient<ReferralRecord[]>('/referrals/list'),
    enabled: true,
    staleTime: 60_000,
  });

  const referralLink = user?.id ? `${window.location.origin}/register?ref=${user.id}` : '';

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(referralLink)
        .then(() => {
          toast.success(t`Referral link copied!`);
        })
        .catch(() => {
          toast.error(t`Failed to copy link`);
        });
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = referralLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success(t`Referral link copied!`);
    }
  };

  const handleShare = (platform: string) => {
    const text = t`Join me on StackBluff! Use my referral link: ${referralLink}`;
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

  const isLoading = statsLoading || referralsLoading;

  if (isLoading) {
    return <ReferralsSkeleton />;
  }

  if (statsError || referralsError || !stats) {
    return (
      <ErrorState
        onRetry={() => window.location.reload()}
        message={t`Failed to load referral data.`}
      />
    );
  }

  const { total_referred, bonus_earned, pending_bonus } = stats;
  const hasFoundingMember = bonus_earned >= 10;
  const progressToFounding = Math.min((bonus_earned / 10) * 100, 100);

  return (
    <div className="relative max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-data-mono uppercase tracking-widest text-purple-400">
            <Trans>Viral Rewards</Trans>
          </span>
        </div>
        <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface flex items-center gap-3">
          <Trans>Referrals</Trans>
        </h1>
        <p className="text-on-surface-variant text-sm mt-1 max-w-md">
          <Trans>Invite friends to StackBluff. Earn chips and unlock exclusive badges.</Trans>
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div variants={itemVariants}>
            <Card className="p-6 bg-white/5 backdrop-blur-xl border-white/10 shadow-xl rounded-2xl h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  <Trans>Total Referrals</Trans>
                </span>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <div className="text-3xl font-bold font-data-mono text-on-surface">
                {total_referred}
              </div>
              <p className="text-xs text-on-surface-variant mt-1 opacity-80">
                <Trans>Friends invited</Trans>
              </p>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="p-6 bg-white/5 backdrop-blur-xl border-white/10 shadow-xl rounded-2xl h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  <Trans>Bonus Earned</Trans>
                </span>
                <div className="w-8 h-8 rounded-full bg-tertiary/10 flex items-center justify-center">
                  <Coins className="w-4 h-4 text-tertiary" />
                </div>
              </div>
              <div className="text-3xl font-bold font-data-mono text-tertiary">
                {bonus_earned * 100}
              </div>
              <p className="text-xs text-on-surface-variant mt-1 opacity-80">
                <Trans>Chips distributed</Trans>
              </p>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="p-6 bg-white/5 backdrop-blur-xl border-white/10 shadow-xl rounded-2xl h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  <Trans>Pending Bonus</Trans>
                </span>
                <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-yellow-400" />
                </div>
              </div>
              <div className="text-3xl font-bold font-data-mono text-yellow-400">
                {pending_bonus * 100}
              </div>
              <p className="text-xs text-on-surface-variant mt-1 opacity-80">
                <Trans>Awaiting hands played</Trans>
              </p>
            </Card>
          </motion.div>
        </div>

        {/* Founding Member Progress */}
        <motion.div variants={itemVariants}>
          <Card
            className={cn(
              'p-6 backdrop-blur-xl border shadow-xl rounded-2xl transition-colors duration-300',
              hasFoundingMember
                ? 'bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border-yellow-500/30'
                : 'bg-white/5 border-white/10',
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300',
                  hasFoundingMember
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-white/5 border-white/10',
                )}
              >
                <Crown
                  className={cn(
                    'w-6 h-6 transition-colors duration-300',
                    hasFoundingMember ? 'text-yellow-400' : 'text-on-surface-variant/40',
                  )}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-headline-md text-base text-on-surface leading-tight">
                    <Trans>Founding Member Badge</Trans>
                  </h3>
                  {hasFoundingMember ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-yellow-500/30 text-yellow-400 bg-yellow-500/10 font-mono"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      <Trans>Unlocked</Trans>
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-white/10 text-on-surface-variant bg-white/5 font-mono"
                    >
                      {10 - bonus_earned} <Trans>referrals needed</Trans>
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-on-surface-variant mt-1.5 mb-3">
                  <Trans>
                    Refer 10 friends who play at least 5 hands to permanently unlock this exclusive
                    badge.
                  </Trans>
                </p>
                <div className="relative w-full h-2 bg-black/20 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressToFounding}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full shadow-lg"
                  />
                </div>
                <div className="flex justify-between text-xs text-on-surface-variant mt-2 font-mono">
                  <span>{bonus_earned} / 10</span>
                  <span>{Math.round(progressToFounding)}%</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Referral Link & Share */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 bg-white/5 backdrop-blur-xl border-white/10 shadow-xl rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                  <Trans>Your Referral Link</Trans>
                </p>
                <div className="flex items-center gap-2 bg-black/30 border border-white/5 rounded-xl px-4 py-3">
                  <LinkIcon className="w-4 h-4 text-on-surface-variant/50 flex-shrink-0" />
                  <span className="text-sm text-on-surface truncate font-data-mono">
                    {referralLink}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0 md:self-end">
                <Button
                  onClick={handleCopyLink}
                  className="bg-tertiary text-on-tertiary hover:bg-tertiary-fixed px-4 py-2.5 rounded-xl h-auto"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  <Trans>Copy</Trans>
                </Button>
                <Button
                  onClick={() => handleShare('twitter')}
                  variant="outline"
                  size="icon"
                  className="bg-white/5 border-white/10 hover:bg-white/10 rounded-xl h-auto w-auto p-2.5"
                  title={t`Share on X`}
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleShare('telegram')}
                  variant="outline"
                  size="icon"
                  className="bg-white/5 border-white/10 hover:bg-white/10 rounded-xl h-auto w-auto p-2.5"
                  title={t`Share on Telegram`}
                >
                  <Send className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleShare('whatsapp')}
                  variant="outline"
                  size="icon"
                  className="bg-white/5 border-white/10 hover:bg-white/10 rounded-xl h-auto w-auto p-2.5"
                  title={t`Share on WhatsApp`}
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Referred Friends List */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-xl rounded-2xl overflow-hidden">
            <div className="p-6 pb-4 border-b border-white/5">
              <h3 className="font-headline-md text-base text-on-surface flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <Trans>Referred Friends</Trans>
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">
                <Trans>Track progress of players you've invited</Trans>
              </p>
            </div>
            <div className="p-6 pt-4">
              {referrals && referrals.length > 0 ? (
                <div className="space-y-3">
                  {referrals.map((ref) => (
                    <motion.div
                      key={ref.referred_id}
                      layout
                      className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.06] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">
                          {(ref.display_name || 'P').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm text-on-surface font-medium truncate block">
                            {ref.display_name || t`Player ${ref.referred_id.slice(0, 8)}`}
                          </span>
                          <span className="text-xs text-on-surface-variant font-mono">
                            {ref.hand_count} <Trans>hands played</Trans>
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {ref.bonus_awarded ? (
                          <span className="text-xs text-tertiary font-medium flex items-center gap-1 bg-tertiary/10 px-2 py-1 rounded-md">
                            <CheckCircle className="w-3 h-3" /> <Trans>Awarded</Trans>
                          </span>
                        ) : ref.hand_count >= 5 ? (
                          <span className="text-xs text-yellow-400 font-medium flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded-md">
                            <Clock className="w-3 h-3" /> <Trans>Pending</Trans>
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant font-medium flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md">
                            <TrendingUp className="w-3 h-3" /> {5 - ref.hand_count}{' '}
                            <Trans>left</Trans>
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <Users className="w-6 h-6 text-on-surface-variant/50" />
                  </div>
                  <p className="text-sm text-on-surface-variant font-medium">
                    <Trans>No referrals yet</Trans>
                  </p>
                  <p className="text-xs text-on-surface-variant/70 mt-1">
                    <Trans>Share your link above to start earning chips!</Trans>
                  </p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

function ReferralsSkeleton() {
  return (
    <div className="relative max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-pulse">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      <div className="space-y-2">
        <Skeleton className="h-4 w-32 bg-white/5" />
        <Skeleton className="h-8 w-48 bg-white/5" />
        <Skeleton className="h-4 w-64 bg-white/5" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 bg-white/5 rounded-2xl" />
        ))}
      </div>

      <Skeleton className="h-36 bg-white/5 rounded-2xl" />
      <Skeleton className="h-24 bg-white/5 rounded-2xl" />
      <Skeleton className="h-64 bg-white/5 rounded-2xl" />
    </div>
  );
}
