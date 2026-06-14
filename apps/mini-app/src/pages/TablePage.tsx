import { useParams } from '@tanstack/react-router';
import { useGameWebSocket } from '../hooks/useGameWebSocket';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { SeatGrid } from '../components/SeatGrid';
import { ActionBar } from '../components/ActionBar';
import { AnalyticsPanel } from '../components/AnalyticsPanel';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { MotionCard } from '@stackbluff/shared/ui/motion-wrappers';

export function TablePage() {
  const { tableId } = useParams({ from: '/table/$tableId' });
  const { sendAction, connectionStatus } = useGameWebSocket(tableId);
  const isDesktop = useResponsiveLayout();
  const { seats, heroSeat, communityCards, pot, actionRequired, toCall, minRaise, maxRaise } = useGameStore();

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      {/* Table container – rounded rectangle for desktop */}
      <div className={`relative mx-auto mt-8 ${isDesktop ? 'w-11/12 max-w-6xl aspect-table-desktop rounded-3xl' : 'w-full h-2/3 rounded-xl'} bg-gradient-to-br from-emerald-950/60 to-black shadow-2xl border border-white/10`}>
        <SeatGrid seats={seats} heroSeat={heroSeat} isDesktop={isDesktop} />
        {/* Community cards */}
        <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 flex gap-2">
          {communityCards.map((card, idx) => (
            <MotionCard key={idx} className="w-14 h-20 bg-white rounded-md shadow-lg" />
          ))}
        </div>
      </div>
      <AnalyticsPanel isDesktop={isDesktop} />
      <ActionBar
        isDesktop={isDesktop}
        actionRequired={actionRequired}
        toCall={toCall}
        minRaise={minRaise}
        maxRaise={maxRaise}
        onAction={sendAction}
      />
      {connectionStatus !== 'connected' && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm">
          {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
        </div>
      )}
    </div>
  );
}
