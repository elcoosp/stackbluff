import { useState, useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { GlassPanel } from "@stackbluff/shared/ui/GlassPanel";
import { Card } from "@/components/ui/card";
import { motion } from 'framer-motion';
import { useClubDetails } from '../hooks/useClubDetails';
import { useClubWebSocket } from '../hooks/useClubWebSocket';
import { ClubHeader } from '../components/club/ClubHeader';
import { ClubTabs, type TabKey } from '../components/club/ClubTabs';
import { ClubLeaderboardTab } from '../components/club/ClubLeaderboardTab';
import { ClubTournamentsTab } from '../components/club/ClubTournamentsTab';
import { ClubSettingsTab } from '../components/club/ClubSettingsTab';
import { ClubPageSkeleton } from '../components/club/LoadingSkeletons';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { handleApiError } from '../lib/errorHandler';
import { logger } from '../lib/logger';
import { XCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackClubView } from '@/lib/customAnalytics';
import { Trans, t } from '@lingui/react/macro';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
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

export function ClubPage() {
  const { clubId } = useParams({ from: '/clubs/$clubId' });
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard');

  const { data: club, isLoading, error } = useClubDetails(clubId);
  useEffect(() => {
    if (club) {
      trackClubView(clubId, club.name);
    }
  }, [club, clubId]);

  // Listen for real-time club updates via WebSocket
  useClubWebSocket(clubId);

  if (isLoading) {
    return <ClubPageSkeleton />;
  }

  if (error) {
    logger.error('Failed to load club', error instanceof Error ? error : undefined, { clubId });
    handleApiError(error, { clubId });

    return (
      <div className="relative max-w-5xl mx-auto p-4 md:p-8">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="font-display-lg text-3xl text-on-surface mb-2"><Trans>Failed to Load Club</Trans></h1>
          <p className="text-on-surface-variant text-sm mb-6">
            {error instanceof Error ? error.message : t`An unexpected error occurred`}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-tertiary text-on-tertiary hover:bg-tertiary/80 rounded-xl"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> <Trans>Retry</Trans>
          </Button>
        </motion.div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="relative max-w-5xl mx-auto p-4 md:p-8">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-on-surface-variant" />
          </div>
          <h1 className="font-display-lg text-3xl text-on-surface mb-2"><Trans>Club Not Found</Trans></h1>
          <p className="text-on-surface-variant text-sm"><Trans>The requested club does not exist.</Trans></p>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { key: 'leaderboard' as const, label: t`Leaderboard`, visible: true },
    { key: 'tournaments' as const, label: t`Tournaments`, visible: true },
    { key: 'settings' as const, label: t`Settings`, visible: club.is_owner },
  ];

  return (
    <ErrorBoundary>
      <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        {/* Background Ambient Effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          <motion.div variants={itemVariants}>
            <ClubHeader club={club} />
          </motion.div>

          <motion.div variants={itemVariants}>
            <ClubTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
              <GlassPanel className="p-6 md:p-8 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl relative overflow-hidden">
                {activeTab === 'leaderboard' && <ClubLeaderboardTab clubId={clubId} />}
                {activeTab === 'tournaments' && (
                  <ClubTournamentsTab clubId={clubId} isOwner={club.is_owner} />
                )}
                {activeTab === 'settings' && club.is_owner && <ClubSettingsTab club={club} />}
              </GlassPanel>
            </ClubTabs>
          </motion.div>
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
