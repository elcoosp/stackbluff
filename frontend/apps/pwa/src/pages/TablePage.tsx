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
import { useFeedback } from '@stackbluff/shared/hooks/useFeedback';
import { FeedbackSettingsDialog } from '@stackbluff/shared/components/feedback/FeedbackSettingsDialog';
import { VisualFeedbackOverlay } from '@stackbluff/shared/components/feedback/VisualFeedbackOverlay';
import type { FeedbackEvent } from '@stackbluff/shared/services/feedback/types';
import { ErrorBoundary } from 'react-error-boundary';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Settings } from 'lucide-react';
import { motion } from 'motion/react';

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

/* ═══════════════════════════════════════════════════════════════════
   useGameFeedback – with seat‑aware triggers
   ═══════════════════════════════════════════════════════════════════ */
function useGameFeedback(
  game: ReturnType<typeof useGameStore>,
  resolvedHeroSeat: number,
  isMyTurn: boolean,
  heroTimerRemainingMs: number | null,
  heroTimerTotalMs: number | null,
) {
  const { trigger } = useFeedback();

  const prevCommunityLen = useRef(0);
  const prevShowdown = useRef(game.showdownReveal);
  const prevCurrentTurn = useRef(game.currentTurnUserId);
  const prevSeatActions = useRef<Record<number, string>>({});
  const prevPot = useRef(game.pot);
  const prevActionRequired = useRef(!!game.actionRequired);

  // Helper to find seat index for a user ID
  const getSeatByUserId = useCallback(
    (userId: string): number | undefined => {
      for (const [seatIdx, seat] of Object.entries(game.seats)) {
        if (seat.user_id === userId) return Number(seatIdx);
      }
      return undefined;
    },
    [game.seats],
  );

  useEffect(() => {
    const len = game.communityCards?.length ?? 0;
    if (len > prevCommunityLen.current && len > 0) {
      if (len === 3) trigger('dealCommunity');
      else trigger('cardDeal');
    }
    prevCommunityLen.current = len;
  }, [game.communityCards, trigger]);

  useEffect(() => {
    if (game.showdownReveal && !prevShowdown.current) {
      trigger('showdown');
      // For winners, we trigger win/lose per seat later
    }
    if (game.showdownReveal) {
      const players = game.showdownReveal.players ?? [];
      for (const p of players) {
        if (p.is_winner) {
          const event: FeedbackEvent = p.seat === resolvedHeroSeat ? 'win' : 'lose';
          trigger(event, { seatIndex: p.seat });
          setTimeout(() => trigger('potCollect', { seatIndex: p.seat }), 400);
          break; // only one winner per hand (for now)
        }
      }
    }
    prevShowdown.current = game.showdownReveal;
  }, [game.showdownReveal, resolvedHeroSeat, trigger]);

  useEffect(() => {
    if (isMyTurn && !prevActionRequired.current) {
      trigger('notification', { seatIndex: resolvedHeroSeat });
    }
    prevActionRequired.current = isMyTurn;
  }, [isMyTurn, trigger, resolvedHeroSeat]);

  useEffect(() => {
    if (
      game.currentTurnUserId &&
      game.currentTurnUserId !== prevCurrentTurn.current &&
      game.currentTurnUserId !== resolvedHeroSeat
    ) {
      const seatIdx = getSeatByUserId(game.currentTurnUserId);
      if (seatIdx !== undefined) {
        trigger('chipClink', { seatIndex: seatIdx });
      }
    }
    prevCurrentTurn.current = game.currentTurnUserId;
  }, [game.currentTurnUserId, game.seats, resolvedHeroSeat, trigger, getSeatByUserId]);

  useEffect(() => {
    for (const [idx, seatRaw] of Object.entries(game.seats)) {
      const seat = seatRaw as any;
      const seatNum = Number(idx);
      const prevAction = prevSeatActions.current[seatNum];
      const currAction = seat.action?.text;
      if (currAction && currAction !== prevAction && seatNum !== resolvedHeroSeat) {
        const actionToEvent: Record<string, FeedbackEvent> = {
          CHECK: 'check', CALL: 'call', BET: 'bet',
          RAISE: 'raise', FOLD: 'fold', 'ALL-IN': 'allIn',
        };
        const event = actionToEvent[currAction];
        if (event) trigger(event, { seatIndex: seatNum });
      }
      if (currAction) prevSeatActions.current[seatNum] = currAction;
    }
  }, [game.seats, resolvedHeroSeat, trigger]);

  useEffect(() => {
    const delta = game.pot - prevPot.current;
    if (delta > 0 && prevPot.current > 0 && Math.abs(delta) > prevPot.current * 0.5) {
      trigger('roundStart');
    }
    if (delta < 0 && prevPot.current > 0 && Math.abs(delta) >= prevPot.current * 0.5) {
      // Pot collected – we'll trigger per winner instead
    }
    prevPot.current = game.pot;
  }, [game.pot, trigger]);

  const prevTimerLevel = useRef<'safe' | 'urgent' | 'final' | 'none'>('none');
  useEffect(() => {
    if (!isMyTurn || heroTimerRemainingMs === null || heroTimerTotalMs === null) {
      prevTimerLevel.current = 'none';
      return;
    }
    const ratio = heroTimerRemainingMs / heroTimerTotalMs;
    let level: 'safe' | 'urgent' | 'final';
    if (ratio <= 0.1) level = 'final';
    else if (ratio <= 0.25) level = 'urgent';
    else level = 'safe';
    if (level !== prevTimerLevel.current) {
      if (level === 'urgent') trigger('timerUrgent', { seatIndex: resolvedHeroSeat });
      if (level === 'final') trigger('timerFinal', { seatIndex: resolvedHeroSeat });
    }
    prevTimerLevel.current = level;
  }, [isMyTurn, heroTimerRemainingMs, heroTimerTotalMs, trigger, resolvedHeroSeat]);
}

/* ═══════════════════════════════════════════════════════════════════
   useDelayedBoolean
   ═══════════════════════════════════════════════════════════════════ */
function useDelayedBoolean(value: boolean, delayMs: number): boolean {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (value) {
      const timer = setTimeout(() => setDelayed(true), delayMs);
      return () => clearTimeout(timer);
    } else {
      setDelayed(false);
    }
  }, [value, delayMs]);

  return delayed;
}

/* ═══════════════════════════════════════════════════════════════════
   TablePage
   ═══════════════════════════════════════════════════════════════════ */
export function TablePage() {
  const { tableId } = useParams({ from: '/table/$tableId' });
  const { sendAction, connectionStatus, myUserId } = useGameWebSocket(tableId);
  const isDesktop = useResponsiveLayout();
  const showAnalytics = useMediaQuery('(min-width: 980px)');
  const game = useGameStore();
  const { trigger } = useFeedback();
  const [showSettings, setShowSettings] = useState(false);

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

  const heroSeatByUserId = myUserId
    ? Object.entries(seats).find(([, s]: [string, any]) => s.user_id === myUserId)
    : null;
  const resolvedHeroSeat: number = heroSeatByUserId
    ? Number(heroSeatByUserId[0])
    : heroSeat ?? 0;

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

  const seatsWithShowdown = { ...seatsWithHeroCards };
  if (showdownReveal) {
    for (const player of showdownReveal.players) {
      const seatIndex = player.seat;
      if (seatsWithShowdown[seatIndex]) {
        const shouldRevealCards = player.hole_cards && player.hole_cards.length > 0;
        seatsWithShowdown[seatIndex] = {
          ...seatsWithShowdown[seatIndex],
          hole_cards: shouldRevealCards ? player.hole_cards : seatsWithShowdown[seatIndex].hole_cards,
          hand_description: player.hand_description,
          is_winner: player.is_winner,
          win_amount: player.win_amount,
          is_showdown_revealed: true,
        };
      }
    }
  }

  const displayCommunityCards =
    showdownReveal?.community_cards?.length
      ? showdownReveal.community_cards
      : communityCards;

  const isMyTurn = !!actionRequired;
  const toCall = actionRequired?.to_call ?? 0;
  const minRaiseDelta = actionRequired?.min_raise ?? 0;
  const potForAction = actionRequired?.pot ?? pot;

  const heroStack = seatsWithShowdown[resolvedHeroSeat]?.stack || 0;
  const minRaiseAmount = toCall + minRaiseDelta;
  const canRaise = heroStack >= minRaiseAmount;
  const maxRaiseAmount = heroStack > 0 ? heroStack : minRaiseAmount;
  const finalMinRaise = canRaise ? minRaiseAmount : maxRaiseAmount;

  const { preAction, togglePreAction, executingAction } = usePreAction({
    isMyTurn,
    toCall,
    sendAction,
  });

  const showdownMorphComplete = useDelayedBoolean(!!showdownReveal, 400);

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

  useGameFeedback(
    game,
    resolvedHeroSeat,
    isMyTurn,
    heroTimerRemainingMs ?? 0,
    heroTimerTotalMs ?? 0,
  );

  const sendActionWithFeedback = useCallback(
    (action: string, amount?: number) => {
      sendAction(action, amount);
      const actionToEvent: Record<string, FeedbackEvent> = {
        fold: 'fold', check: 'check', call: 'call',
        bet: 'bet', raise: 'raise', 'all-in': 'allIn',
      };
      const eventType = actionToEvent[action];
      if (eventType) trigger(eventType, { seatIndex: resolvedHeroSeat });
    },
    [sendAction, trigger, resolvedHeroSeat],
  );

  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      <div
        className="h-full w-full relative overflow-hidden select-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, #1a1c1b 0%, #111 40%, #0a0a0a 100%)',
        }}
      >
        <VisualFeedbackOverlay />
        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => { setShowSettings(true); trigger('buttonClick'); }}
          className={cn(
            "absolute top-3 right-3 z-[700] p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-black/70 transition-all",
            !isDesktop && "top-16"
          )}
          aria-label="Feedback settings"
        >
          <Settings className="w-4 h-4" />
        </motion.button>

        <FeedbackSettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />

        {!showAnalytics && (
          <MobileAnalyticsStrip winProb={winProb} potOdds={potOdds} bestHand={bestHand} strength={strength} />
        )}

        <div className="flex items-center justify-center h-full pt-3 px-3 pb-3 md:pt-4 md:px-4 md:pb-4">
          <div
            className="relative w-full h-full"
            style={{ maxWidth: isDesktop ? '1000px' : '500px', transition: 'max-width 0.4s ease' }}
          >
            <TableRail isMobile={!isDesktop} />

            <div className="absolute inset-3 md:inset-10" style={{ transition: 'inset 0.4s ease' }}>
              <TableFelt isMobile={!isDesktop} />

              <div className="absolute top-[40%] md:top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <CommunityCards
                  cards={displayCommunityCards}
                  isMobile={!isDesktop}
                  revealedCount={displayCommunityCards.length}
                />
              </div>

              <div className={cn(
                "absolute left-1/2 -translate-x-1/2 z-30 transition-all duration-700 ease-in-out",
                showdownReveal
                  ? "top-[4%] md:top-[3%]"
                  : "top-[6%] md:top-[3%]"
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

            <BetAnimationLayer isDesktop={isDesktop} heroSeat={resolvedHeroSeat} />

            {showdownMorphComplete && (
              <ChipAnimationLayer isDesktop={isDesktop} heroSeat={resolvedHeroSeat} potRef={potRef} />
            )}
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
          onAction={sendActionWithFeedback}
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
