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
  const isDesktop = useResponsiveLayout();
  const showAnalytics = useMediaQuery('(min-width: 980px)');
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

  // ── Merge hero hole cards into the hero's seat ──
  const seatsWithHeroCards = { ...seats };
  if (heroSeat !== null && heroSeat !== undefined && heroHoleCards && heroHoleCards.length === 2) {
    if (seatsWithHeroCards[heroSeat]) {
      seatsWithHeroCards[heroSeat] = {
        ...seatsWithHeroCards[heroSeat],
        hole_cards: heroHoleCards,
      };
    } else {
      seatsWithHeroCards[heroSeat] = {
        seat: heroSeat,
        user_id: 'hero',
        stack: 0,
        current_bet: 0,
        is_all_in: false,
        is_folded: false,
        is_active: false,
        display_name: 'You',
        avatar_url: undefined,
        hole_cards: heroHoleCards,
        position_badge: undefined,
        // action prop removed – not needed
      };
    }
  }

  const timerTotalMs = actionRequired ? actionRequired.timeout_secs * 1000 : null;
  const toCall = actionRequired?.to_call ?? 0;
  const minRaise = actionRequired?.min_raise ?? 0;
  // const canCheck = actionRequired?.can_check ?? false; // not used
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
        {!isDesktop && (
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
              seats={seatsWithHeroCards}
              heroSeat={heroSeat ?? 0}
              dealerIndex={dealerIndex}
              isDesktop={isDesktop}
              currentTurnUserId={currentTurnUserId}
              timerTotalMs={timerTotalMs}
            />
          </div>
        </div>

        {showAnalytics && (
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
          maxRaise={Math.max(minRaise * 2, 1000)}
          pot={potForAction}
          onAction={sendAction}
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
