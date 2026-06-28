import { ErrorBoundary } from '../components/ErrorBoundary';
import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { Card } from '@stackbluff/shared/ui/Card';
import { ClubLeaderboardTab } from '../components/club/ClubLeaderboardTab';
import { ClubTournamentsTab } from '../components/club/ClubTournamentsTab';
import { ClubSettingsTab } from '../components/club/ClubSettingsTab';
import { useClubWebSocket } from '../hooks/useClubWebSocket';

type TabKey = 'leaderboard' | 'tournaments' | 'settings';

export interface ClubDetails {
  id: string;
  name: string;
  logo_url: string | null;
  telegram_group_id: string | null;
  is_owner: boolean;
  members_count: number;
  pro_settings?: {
    banner_url?: string;
    chip_preset?: string;
    felt_colour?: string;
  };
}

export function ClubPage() {
  const { clubId } = useParams({ from: '/clubs/$clubId' });
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard');
  const [club, setClub] = useState<ClubDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen for real-time club updates via WebSocket
  useClubWebSocket(clubId);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchClub = async () => {
      try {
        const response = await fetch(`/api/clubs/${clubId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch club: ${response.statusText}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setClub(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchClub();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white/60">Loading club...</div>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-red-400">Error</h2>
          <p className="text-white/60 mt-2">{error ?? 'Club not found'}</p>
        </Card>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; visible: boolean }[] = [
    { key: 'leaderboard', label: 'Leaderboard', visible: true },
    { key: 'tournaments', label: 'Tournaments', visible: true },
    { key: 'settings', label: 'Settings', visible: club.is_owner },
  ];

  return (
    <ErrorBoundary>
      <div className="container" mx-auto px-4 py-8 max-w-6xl">
      {/* Club Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          {club.logo_url ? (
            <img
              src={club.logo_url}
              alt={club.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center text-2xl font-bold text-white/60">
              {club.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-white">{club.name}</h1>
            <p className="text-white/60">{club.members_count} members</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-white/10">
        {tabs
          .filter((t) => t.visible)
          .map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'text-white'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
              )}
            </button>
          ))}
      </div>

      {/* Tab Content */}
      <GlassPanel className="p-6">
        {activeTab === 'leaderboard' && <ClubLeaderboardTab clubId={clubId} />}
        {activeTab === 'tournaments' && <ClubTournamentsTab clubId={clubId} isOwner={club.is_owner} />}
        {activeTab === 'settings' && club.is_owner && (
          <ClubSettingsTab club={club} />
        )}
      </GlassPanel>
    </div>
    </ErrorBoundary>
  );
}
