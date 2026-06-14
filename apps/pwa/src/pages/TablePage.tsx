import { useParams } from '@tanstack/react-router';
import { useGameWebSocket } from '../hooks/useGameWebSocket';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';

// Dummy components – replace with actual imports if needed
const SeatGrid = () => <div className="absolute inset-0 flex items-center justify-center text-white">SeatGrid</div>;
const ActionBar = () => null;
const AnalyticsPanel = () => null;
const CommunityCards = () => null;
const TableFelt = () => <div className="absolute inset-0 rounded-[124px] bg-emerald-950/60" />;
const TableRail = () => <div className="absolute inset-[-40px] rounded-[140px] bg-black/40" />;
const PotBadge = ({ amount }: { amount: number }) => <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white">Pot: ${amount}</div>;
const TimerBar = () => null;

export function TablePage() {
  const { tableId } = useParams({ from: '/table/$tableId' });
  const { sendAction, connectionStatus } = useGameWebSocket(tableId);
  const isDesktop = useResponsiveLayout();
  const { seats, heroSeat, communityCards, pot, actionRequired, toCall, minRaise, maxRaise, timeRemainingMs } = useGameStore();

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden" style={{ background: 'radial-gradient(circle at center, #1a1c1b 0%, #131313 100%)' }}>
      <div className={`relative mx-auto mt-8 ${isDesktop ? 'w-[95%] max-w-[1100px] aspect-table-desktop' : 'w-full h-2/3'}`}>
        <TableRail /><TableFelt />
        <SeatGrid />
        <CommunityCards />
        <PotBadge amount={pot} />
        {actionRequired && <TimerBar />}
      </div>
      <AnalyticsPanel />
      <ActionBar />
      {connectionStatus !== 'connected' && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm z-[500]">
          {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
        </div>
      )}
    </div>
  );
}
