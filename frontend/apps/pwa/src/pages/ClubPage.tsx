import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { Card } from '@stackbluff/shared/ui/Card';
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

export function ClubPage() {
  const { clubId } = useParams({ from: '/clubs/$clubId' });
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard');

  const { data: club, isLoading, error } = useClubDetails(clubId);

  // Listen for real-time club updates via WebSocket
  useClubWebSocket(clubId);

  if (isLoading) {
    return <ClubPageSkeleton />;
  }

  if (error) {
    logger.error('Failed to load club', error instanceof Error ? error : undefined, { clubId });
    handleApiError(error, { clubId });

    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-red-400">Error</h2>
          <p className="text-white/60 mt-2">
            {error instanceof Error ? error.message : 'Failed to load club'}
          </p>
        </Card>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-red-400">Club not found</h2>
          <p className="text-white/60 mt-2">The requested club does not exist.</p>
        </Card>
      </div>
    );
  }

  const tabs = [
    { key: 'leaderboard' as const, label: 'Leaderboard', visible: true },
    { key: 'tournaments' as const, label: 'Tournaments', visible: true },
    { key: 'settings' as const, label: 'Settings', visible: club.is_owner },
  ];

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <ClubHeader club={club} />

        <ClubTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
          <GlassPanel className="p-6">
            {activeTab === 'leaderboard' && <ClubLeaderboardTab clubId={clubId} />}
            {activeTab === 'tournaments' && (
              <ClubTournamentsTab clubId={clubId} isOwner={club.is_owner} />
            )}
            {activeTab === 'settings' && club.is_owner && <ClubSettingsTab club={club} />}
          </GlassPanel>
        </ClubTabs>
      </div>
    </ErrorBoundary>
  );
}
