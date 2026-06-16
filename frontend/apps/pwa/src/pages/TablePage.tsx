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
} from '../components/game';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { ErrorBoundary } from 'react-error-boundary';
import { useState, useEffect } from 'react';

function Fallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="p-4 text-error">
      <p>Game UI error: {error.message}</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

// ── Media query hook ──
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
}

export function TablePage() {
  const { tableId } = useParams({ from: '/table/$tableId' });
  const { sendAction, connectionStatus } = useGameWebSocket(tableId);
  const isDesktop = useResponsiveLayout(); // >= 768px for table layout
  const showDesktopAnalytics = useMediaQuery('(min-width: 980px)'); // >= 980px for side panels
  const showMobileAnalytics = useMediaQuery('(max-width: 979px)'); // < 980px for mobile strip
  const game = useGameStore();

  const {
    seats,
    communityCards,
    pot,
    sidePots,
    street,
    heroSeat,
    heroHoleCards,
    actionRequired,
    currentTurnUserId,
    dealerIndex,
  } = game;

  const timerTotalMs = actionRequired ? actionRequired.timeoutSecs * 1000 : null;

  const toCall = actionRequired?.toCall ?? 0;
  const minRaise = actionRequired?.minRaise ?? 0;
  const canCheck = actionRequired?.canCheck ?? false;
  const potForAction = actionRequired?.pot ?? pot;

  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      <div
        className="h-full w-full relative overflow-hidden select-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, #1a1c1b 0%, #111 40%, #0a0a0a 100%)',
        }}
      >
        {showMobileAnalytics && (
          <MobileAnalyticsStrip winProb={74} potOdds={3.2} bestHand="Two Pair" strength={92} />
        )}

        <div className="flex items-center justify-center h-full pt-3 px-3 pb-26 md:pt-4 md:px-4 md:pb-16">
          <div
            className="relative w-full"
            style={{
              ...(isDesktop
                ? { aspectRatio: '2 / 1', maxWidth: '1000px', maxHeight: '100%' }
                : { height: '100%', maxWidth: '500px' }),
              transition: 'max-width 0.4s ease',
            }}
          >
            <TableRail isMobile={!isDesktop} />

            <div
              className="absolute inset-3 md:inset-10"
              style={{ transition: 'inset 0.4s ease' }}
            >
              <TableFelt isMobile={!isDesktop} />

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <CommunityCards cards={communityCards} isMobile={!isDesktop} />
              </div>

              <div className="absolute top-[6%] md:top-[3%] left-1/2 -translate-x-1/2 z-10">
                <PotBadge amount={pot} />
              </div>
            </div>

            <SeatGrid
              seats={seats}
              heroSeat={heroSeat ?? 0}
              dealerIndex={dealerIndex}
              isDesktop={isDesktop}
              currentTurnUserId={currentTurnUserId}
              timerTotalMs={timerTotalMs}
            />
          </div>
        </div>

        {/* ── Desktop analytics: only shown on screens ≥ 980px ── */}
        {showDesktopAnalytics && (
          <>
            <TacticalOracle winProb={74} potOdds={3.2} />
            <HandStrength bestHand="Two Pair" strength={92} />
          </>
        )}

        <ActionBar
          isDesktop={isDesktop}
          actionRequired={!!actionRequired}
          toCall={toCall}
          minRaise={minRaise}
          maxRaise={minRaise * 2}
          pot={potForAction}
          onAction={sendAction}
          canCheck={canCheck}
        />

        {connectionStatus !== 'connected' && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-mono z-[500] border border-white/10">
            {connectionStatus === 'reconnecting' ? '⚡ Reconnecting…' : '⛔ Disconnected'}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
