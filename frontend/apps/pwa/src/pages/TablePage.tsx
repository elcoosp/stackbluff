import { useParams } from '@tanstack/react-router';
import { useGameWebSocket } from '../hooks/useGameWebSocket';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import {
  SeatGrid,
  ActionBar,
  TacticalOracle,
  HandStrength,
  MobileAnalyticsStrip,
  CommunityCards,
  TableFelt,
  TableRail,
  PotBadge,
  TimerBar,
} from '../components/game';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';

export function TablePage() {
  const { tableId } = useParams({ from: '/table/$tableId' });
  const { sendAction, connectionStatus } = useGameWebSocket(tableId);
  const isDesktop = useResponsiveLayout();
  const game = useGameStore();

  return (
    <div
      className="h-full w-full relative overflow-hidden select-none"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, #1a1c1b 0%, #111 40%, #0a0a0a 100%)',
      }}
    >
      {!isDesktop && (
        <MobileAnalyticsStrip winProb={74} potOdds={3.2} bestHand="Two Pair" strength={92} />
      )}

      <div className="flex items-center justify-center h-full pt-3 px-3 pb-26 md:pt-4 md:px-4 md:pb-16">
        <div
          className="relative w-full"
          style={{
            /* Mobile: fill available height — no aspect ratio constraint.
               Desktop: classic 2:1 landscape oval. */
            ...(isDesktop
              ? { aspectRatio: '2 / 1', maxWidth: '1000px', maxHeight: '100%' }
              : { height: '100%', maxWidth: '500px' }),
            transition: 'max-width 0.4s ease',
          }}
        >
          <TableRail isMobile={!isDesktop} />

          {/* Felt + centered content — seats are OUTSIDE this wrapper */}
          <div
            className="absolute inset-3 md:inset-10"
            style={{ transition: 'inset 0.4s ease' }}
          >
            <TableFelt isMobile={!isDesktop} />

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <CommunityCards cards={game.communityCards} isMobile={!isDesktop} />
            </div>

            <div className="absolute top-[6%] md:top-[3%] left-1/2 -translate-x-1/2 z-10">
              <PotBadge amount={game.pot} />
            </div>

            {game.actionRequired && game.timeRemainingMs != null && (
              <div className="absolute bottom-[30%] md:bottom-[35%] left-1/2 -translate-x-1/2 w-48 z-10">
                <TimerBar remainingMs={game.timeRemainingMs} />
              </div>
            )}
          </div>

          {/* Seats — positioned relative to OUTER container (includes rail),
              z-[460] > action bar z-[450] so they overlap if needed */}
          <SeatGrid
            seats={game.seats}
            heroSeat={game.heroSeat ?? 0}
            isDesktop={isDesktop}
          />
        </div>
      </div>

      {isDesktop ? (
        <>
          <TacticalOracle winProb={74} potOdds={3.2} />
          <HandStrength bestHand="Two Pair" strength={92} />
        </>
      ) : null}

      <ActionBar
        isDesktop={isDesktop}
        actionRequired={game.actionRequired}
        toCall={game.toCall}
        minRaise={game.minRaise}
        maxRaise={game.maxRaise}
        pot={game.pot}
        onAction={sendAction}
      />

      {connectionStatus !== 'connected' && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-mono z-[500] border border-white/10">
          {connectionStatus === 'reconnecting' ? '⚡ Reconnecting…' : '⛔ Disconnected'}
        </div>
      )}
    </div>
  );
}
