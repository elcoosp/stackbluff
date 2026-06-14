import { useParams } from '@tanstack/react-router';
import { useGameWebSocket } from '../hooks/useGameWebSocket';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { SeatGrid, ActionBar, AnalyticsPanel, CommunityCards, TableFelt, TableRail, PotBadge, TimerBar } from '../components/game';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';

export function TablePage() {
  const { tableId } = useParams({ from: '/table/$tableId' });
  const { sendAction, connectionStatus } = useGameWebSocket(tableId);
  const isDesktop = useResponsiveLayout();
  const { seats, heroSeat, communityCards, pot, actionRequired, toCall, minRaise, maxRaise, timeRemainingMs } = useGameStore();

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      <div className={`relative mx-auto mt-8 ${isDesktop ? 'w-11/12 max-w-6xl aspect-table-desktop rounded-3xl' : 'w-full h-2/3 rounded-xl'}`}>
        <TableRail />
        <TableFelt />
        <SeatGrid seats={seats} heroSeat={heroSeat} isDesktop={isDesktop} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <CommunityCards cards={communityCards} />
        </div>
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <PotBadge amount={pot} />
        </div>
        {actionRequired && <TimerBar remainingMs={timeRemainingMs} />}
      </div>
      <AnalyticsPanel isDesktop={isDesktop} winProb={74} potOdds={3.2} bestHand="Two Pair" strength={92} />
      <ActionBar isDesktop={isDesktop} actionRequired={actionRequired} toCall={toCall} minRaise={minRaise} maxRaise={maxRaise} onAction={sendAction} />
      {connectionStatus !== 'connected' && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full">Reconnecting...</div>}
    </div>
  );
}
