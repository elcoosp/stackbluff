import { useParams } from '@tanstack/react-router';
import { useGameWebSocket } from '../hooks/useGameWebSocket';
import { usePreAction } from '../hooks/usePreAction';
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
  ChipAnimationLayer,
  BetAnimationLayer,
} from '../components/game';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { ErrorBoundary } from 'react-error-boundary';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

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
  const { sendAction, connectionStatus, myUserId } = useGameWebSocket(tableId);
  const isDesktop = useResponsiveLayout();
  const showAnalytics = useMediaQuery('(min-width: 980px)');
  const game = useGameStore();

  const {
    seats,
    communityCards,
    pot,
    heroSeat,
    heroHoleCards,
    actionRequired,
    currentTurnUserId,
    analytics,
    showdownReveal,
  } = game;

  const potRef = useRef<HTMLDivElement>(null);

  const winProb = analytics?.winProb ?? 0;
  const potOdds = analytics?.potOdds ?? 0;
  const bestHand = analytics?.bestHand ?? '—';
  const strength = analytics?.strength ?? 0;

  // ── Resolve hero seat ──
  const heroSeatByUserId = myUserId
    ? Object.entries(seats).find(([, s]: [string, any]) => s.user_id === myUserId)
    : null;
  const resolvedHeroSeat: number = heroSeatByUserId
    ? Number(heroSeatByUserId[0])
    : heroSeat ?? 0;

  // ── Merge hero hole cards into seats ──
  const seatsWithHeroCards = { ...seats };
  if (heroHoleCards && heroHoleCards.length === 2) {
    if (seatsWithHeroCards[resolvedHeroSeat]) {
      seatsWithHeroCards[resolvedHeroSeat] = {
        ...seatsWithHeroCards[resolvedHeroSeat],
        hole_cards: heroHoleCards,
      };
    } else {
      seatsWithHeroCards[resolvedHeroSeat] = {
        seat: resolvedHeroSeat,
        user_id: myUserId || 'hero',
        stack: 0,
        current_bet: 0,
        is_all_in: false,
        is_folded: false,
        is_active: false,
        display_name: 'You',
        avatar_url: undefined,
        hole_cards: heroHoleCards,
        position_badge: undefined,
      };
    }
  }

  // ── Merge showdown reveal: opponent hole cards + winner info ──
  const seatsWithShowdown = { ...seatsWithHeroCards };
  if (showdownReveal) {
    for (const player of showdownReveal.players) {
      const seatIndex = player.seat;
      if (seatsWithShowdown[seatIndex]) {
        seatsWithShowdown[seatIndex] = {
          ...seatsWithShowdown[seatIndex],
          hole_cards: player.hole_cards,
          hand_description: player.hand_description,
          is_winner: player.is_winner,
          win_amount: player.win_amount,
          is_showdown_revealed: true,
        };
      }
    }
  }

  // ── Prefer showdown community cards (guaranteed complete) during showdown ──
  const displayCommunityCards =
    showdownReveal?.community_cards?.length
      ? showdownReveal.community_cards
      : communityCards;

  const isMyTurn = !!actionRequired;
  const toCall = actionRequired?.to_call ?? 0;
  const minRaiseDelta = actionRequired?.min_raise ?? 0;
  const potForAction = actionRequired?.pot ?? pot;

  // ── Calculate correct Min/Max Raise Amounts ──
  const heroStack = seatsWithShowdown[resolvedHeroSeat]?.stack || 0;
  const minRaiseAmount = toCall + minRaiseDelta;
  const canRaise = heroStack >= minRaiseAmount;
  const maxRaiseAmount = heroStack > 0 ? heroStack : minRaiseAmount;
  const finalMinRaise = canRaise ? minRaiseAmount : maxRaiseAmount;

  // ── Pre-action hook ──
  const { preAction, togglePreAction, executingAction } = usePreAction({
    isMyTurn,
    toCall,
    sendAction,
  });

  // ── Hero timer ──
  const heroTimerTotalMs = actionRequired ? actionRequired.timeout_secs * 1000 : null;
  const [heroTimerRemainingMs, setHeroTimerRemainingMs] = useState<number | null>(null);
  const heroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (heroIntervalRef.current) {
      clearInterval(heroIntervalRef.current);
      heroIntervalRef.current = null;
    }
    if (!heroTimerTotalMs) {
      setHeroTimerRemainingMs(null);
      return;
    }
    setHeroTimerRemainingMs(heroTimerTotalMs);
    const start = Date.now();
    const total = heroTimerTotalMs;
    heroIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, total - elapsed);
      setHeroTimerRemainingMs(remaining);
      if (remaining <= 0 && heroIntervalRef.current) {
        clearInterval(heroIntervalRef.current);
        heroIntervalRef.current = null;
      }
    }, 100);
    return () => {
      if (heroIntervalRef.current) {
        clearInterval(heroIntervalRef.current);
        heroIntervalRef.current = null;
      }
    };
  }, [heroTimerTotalMs]);

  // ── Opponent timer ──
  const opponentTurnUserId = !isMyTurn && currentTurnUserId ? currentTurnUserId : null;
  const opponentTimerTotalMs = opponentTurnUserId ? 30000 : null;
  const [opponentTimerRemainingMs, setOpponentTimerRemainingMs] = useState<number | null>(null);
  const opponentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (opponentIntervalRef.current) {
      clearInterval(opponentIntervalRef.current);
      opponentIntervalRef.current = null;
    }
    if (!opponentTurnUserId) {
      setOpponentTimerRemainingMs(null);
      return;
    }
    const total = 30000;
    setOpponentTimerRemainingMs(total);
    const start = Date.now();
    opponentIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, total - elapsed);
      setOpponentTimerRemainingMs(remaining);
      if (remaining <= 0 && opponentIntervalRef.current) {
        clearInterval(opponentIntervalRef.current);
        opponentIntervalRef.current = null;
      }
    }, 100);
    return () => {
      if (opponentIntervalRef.current) {
        clearInterval(opponentIntervalRef.current);
        opponentIntervalRef.current = null;
      }
    };
  }, [opponentTurnUserId]);

  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      <div
        className="h-full w-full relative overflow-hidden select-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, #1a1c1b 0%, #111 40%, #0a0a0a 100%)',
        }}
      >
        {!showAnalytics && (
          <MobileAnalyticsStrip winProb={winProb} potOdds={potOdds} bestHand={bestHand} strength={strength} />
        )}

        <div className="flex items-center justify-center h-full pt-3 px-3 pb-3 md:pt-4 md:px-4 md:pb-4">
          <div
            className="relative w-full h-full"
            style={{
              maxWidth: isDesktop ? '1000px' : '500px',
              transition: 'max-width 0.4s ease',
            }}
          >
            <TableRail isMobile={!isDesktop} />

            <div className="absolute inset-3 md:inset-10" style={{ transition: 'inset 0.4s ease' }}>
              <TableFelt isMobile={!isDesktop} />

              {/* Community cards - RESTORED TO CENTER */}
              <div className="absolute top-[40%] md:top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <CommunityCards
                  cards={displayCommunityCards}
                  isMobile={!isDesktop}
                  revealedCount={displayCommunityCards.length}
                />
              </div>

              {/* Morphing PotBadge / Showdown Plate */}
              <div className={cn(
                "absolute left-1/2 -translate-x-1/2 z-30 transition-all duration-700 ease-in-out",
                showdownReveal ? "top-[30%] -translate-y-1/2" : "top-[6%] md:top-[3%] translate-y-0"
              )}>
                <PotBadge
                  amount={pot}
                  toCall={actionRequired?.to_call}
                  isMobile={!isDesktop}
                  showdownReveal={showdownReveal}
                  potRef={potRef}
                />
              </div>
            </div>

            {/* Seats (with showdown hole cards merged in) */}
            <SeatGrid
              seats={seatsWithShowdown}
              heroSeat={resolvedHeroSeat}
              isDesktop={isDesktop}
              currentTurnUserId={currentTurnUserId}
              heroTimerRemainingMs={heroTimerRemainingMs}
              heroTimerTotalMs={heroTimerTotalMs}
              opponentTurnUserId={opponentTurnUserId}
              opponentTimerRemainingMs={opponentTimerRemainingMs}
              opponentTimerTotalMs={opponentTimerTotalMs}
            />

            {/* Player-to-Pot Bet Animation */}
            <BetAnimationLayer isDesktop={isDesktop} heroSeat={resolvedHeroSeat} />

            {/* Pot-to-Winner Chip Animation (Showdown) */}
            <ChipAnimationLayer isDesktop={isDesktop} heroSeat={resolvedHeroSeat} potRef={potRef} />
          </div>
        </div>

        {showAnalytics && (
          <>
            <TacticalOracle winProb={winProb} potOdds={potOdds} />
            <HandStrength bestHand={bestHand} strength={strength} />
          </>
        )}

        <ActionBar
          isDesktop={isDesktop}
          actionRequired={isMyTurn}
          toCall={toCall}
          minRaise={finalMinRaise}
          maxRaise={maxRaiseAmount}
          pot={potForAction}
          onAction={sendAction}
          preAction={preAction}
          onSetPreAction={togglePreAction}
          executingAction={executingAction}
          heroTimerRemainingMs={heroTimerRemainingMs}
          heroTimerTotalMs={heroTimerTotalMs}
          canRaise={canRaise}
          heroStack={heroStack}
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
