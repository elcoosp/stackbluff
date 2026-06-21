import { useParams, useSearch } from '@tanstack/react-router';
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
  DealAnimationLayer,
  LeaveTableDialog,
  BuyInDialog,
  HistoryDialog,
  PlayerStatsDialog,
} from '../components/game';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { useDealStore } from '@stackbluff/shared/stores/dealStore';
import { useFeedback } from '@stackbluff/shared/hooks/useFeedback';
import { FeedbackSettingsDialog } from '@stackbluff/shared/components/feedback/FeedbackSettingsDialog';
import { VisualFeedbackOverlay } from '@stackbluff/shared/components/feedback/VisualFeedbackOverlay';
import type { FeedbackEvent } from '@stackbluff/shared/services/feedback/types';
import { ErrorBoundary } from 'react-error-boundary';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Settings, LogOut, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';

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
    }
    if (game.showdownReveal) {
      const players = game.showdownReveal.players ?? [];
      for (const p of players) {
        if (p.is_winner) {
          const event: FeedbackEvent = p.seat === resolvedHeroSeat ? 'win' : 'lose';
          trigger(event, { seatIndex: p.seat });
          setTimeout(() => trigger('potCollect', { seatIndex: p.seat }), 400);
          break;
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
  const search = useSearch({ from: '/table/$tableId' });
  const navigate = useNavigate();
  const { sendJoin, sendAction, sendRebuy, connectionStatus, myUserId, notSeated, sendLeave } = useGameWebSocket(tableId);
  const isDesktop = useResponsiveLayout();
  const showAnalytics = useMediaQuery('(min-width: 980px)');
  const game = useGameStore();
  const { trigger } = useFeedback();
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showRebuyDialog, setShowRebuyDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [statsUserId, setStatsUserId] = useState<string | null>(null);
  const { isDealing } = useDealStore();
  const balance = useAuthStore((s) => s.balance);

  // Check if user is explicitly observing
  const isObserving = (search as any)?.observe === 'true' || (search as any)?.observe === true;

  const {
    seats,
    communityCards,
    pot,
    heroSeat,
    heroHoleCards,
    actionRequired,
    currentTurnUserId,
    currentTurnExpiresAt,
    currentTurnTimeoutMs,
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
  if (heroHoleCards && heroHoleCards.length === 2 && !isDealing) {
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
          winning_cards: player.winning_cards,
          is_showdown_revealed: true,
        };
      }
    }
  }

  const displayCommunityCards =
    showdownReveal?.community_cards?.length
      ? showdownReveal.community_cards
      : communityCards;

  const allWinningCards = showdownReveal?.players.flatMap(p => p.winning_cards || []) || [];

  const isMyTurn = !!actionRequired;
  const toCall = actionRequired?.to_call ?? 0;
  const minRaiseDelta = actionRequired?.min_raise ?? 0;
  const potForAction = actionRequired?.pot ?? pot;

  const heroStack = seatsWithShowdown[resolvedHeroSeat]?.stack || 0;
  const minRaiseAmount = toCall + minRaiseDelta;
  const canRaise = heroStack >= minRaiseAmount;
  const maxRaiseAmount = heroStack > 0 ? heroStack : minRaiseAmount;
  const finalMinRaise = canRaise ? minRaiseAmount : maxRaiseAmount;

  // Check if hero is actually seated in the game
  const isHeroSeated = Object.values(seatsWithShowdown).some((s: any) => s.user_id === myUserId);

  // Initial Join Logic
  useEffect(() => {
    if (connectionStatus !== 'connected' || hasJoined) return;

    if (myUserId && isHeroSeated) {
      setHasJoined(true);
      return;
    }

    if (notSeated) {
      const urlBuyIn = (search as any)?.buyIn as number | undefined;
      if (urlBuyIn && urlBuyIn > 0) {
        sendJoin(urlBuyIn);
        setHasJoined(true);
        setIsJoining(true);
        setShowRebuyDialog(false);
      } else if (!isObserving) {
        // Only prompt to buy in if they didn't click "Observe"
        setShowRebuyDialog(true);
      } else {
        // They are observing, let them in without a buy-in prompt
        setHasJoined(true);
      }
    }
  }, [connectionStatus, hasJoined, search, sendJoin, notSeated, myUserId, isObserving, isHeroSeated]);

  // Show Rebuy Dialog if hero runs out of chips
  useEffect(() => {
    if (isJoining && heroStack > 0) {
      setIsJoining(false);
    }

    // Prevent rebuy dialog if they are explicitly observing
    if (hasJoined && heroStack === 0 && !isJoining && connectionStatus === 'connected' && !game.handInProgress && !isObserving) {
      setShowRebuyDialog(true);
    } else if (heroStack > 0) {
      setShowRebuyDialog(false);
    }
  }, [heroStack, connectionStatus, hasJoined, isJoining, game.handInProgress, isObserving]);

  // Prevent "Disconnected" flash on initial mount
  const [showDisconnect, setShowDisconnect] = useState(false);
  useEffect(() => {
    if (connectionStatus !== 'connected') {
      const timer = setTimeout(() => setShowDisconnect(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setShowDisconnect(false);
    }
  }, [connectionStatus]);

  const { preAction, togglePreAction, executingAction } = usePreAction({
    isMyTurn,
    toCall,
    sendAction,
  });

  const showdownMorphComplete = useDelayedBoolean(!!showdownReveal, 400);

  // ── Timer Sync Logic ──
  const heroTimerExpiresAt = actionRequired?.expires_at ?? null;
  const heroTimerTotalMs = actionRequired?.timeout_ms ?? 30000;
  const [heroTimerRemainingMs, setHeroTimerRemainingMs] = useState<number | null>(null);
  const heroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (heroIntervalRef.current) {
      clearInterval(heroIntervalRef.current);
      heroIntervalRef.current = null;
    }

    if (!heroTimerExpiresAt) {
      setHeroTimerRemainingMs(null);
      return;
    }

    const updateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, heroTimerExpiresAt - now);
      setHeroTimerRemainingMs(remaining);
      if (remaining <= 0 && heroIntervalRef.current) {
        clearInterval(heroIntervalRef.current);
        heroIntervalRef.current = null;
      }
    };

    updateRemaining();
    heroIntervalRef.current = setInterval(updateRemaining, 100);

    return () => {
      if (heroIntervalRef.current) {
        clearInterval(heroIntervalRef.current);
        heroIntervalRef.current = null;
      }
    };
  }, [heroTimerExpiresAt]);

  const opponentTurnUserId = !isMyTurn && currentTurnUserId ? currentTurnUserId : null;
  const opponentTimerExpiresAt = opponentTurnUserId ? currentTurnExpiresAt : null;
  const opponentTimerTotalMs = opponentTurnUserId ? (currentTurnTimeoutMs ?? 30000) : null;
  const [opponentTimerRemainingMs, setOpponentTimerRemainingMs] = useState<number | null>(null);
  const opponentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (opponentIntervalRef.current) {
      clearInterval(opponentIntervalRef.current);
      opponentIntervalRef.current = null;
    }
    if (!opponentTimerExpiresAt) {
      setOpponentTimerRemainingMs(null);
      return;
    }

    const updateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, opponentTimerExpiresAt - now);
      setOpponentTimerRemainingMs(remaining);
      if (remaining <= 0 && opponentIntervalRef.current) {
        clearInterval(opponentIntervalRef.current);
        opponentIntervalRef.current = null;
      }
    };

    updateRemaining();
    opponentIntervalRef.current = setInterval(updateRemaining, 100);

    return () => {
      if (opponentIntervalRef.current) {
        clearInterval(opponentIntervalRef.current);
        opponentIntervalRef.current = null;
      }
    };
  }, [opponentTimerExpiresAt]);

  useGameFeedback(
    game,
    resolvedHeroSeat,
    isMyTurn,
    heroTimerRemainingMs ?? 0,
    heroTimerTotalMs,
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

  const handleLeaveTable = useCallback(() => {
    sendLeave();
    navigate({ to: '/lobby' });
  }, [sendLeave, navigate]);

  const isAnyAllIn = Object.values(seatsWithShowdown).some(
    (s: any) => s.is_all_in && !s.is_folded
  );

  // Portal target for header actions
  const headerActionsEl = typeof document !== 'undefined' ? document.getElementById('header-portal-actions') : null;

  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      {/* ROOT CONTAINER: fixed inset-0 prevents scrollbars. */}
      <div
        className="fixed inset-0 w-full overflow-hidden select-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, #1a1c1b 0%, #111 40%, #0a0a0a 100%)',
        }}
      >
        {/* ─── FOCUS OVERLAY ─── */}
        <AnimatePresence>
          {isMyTurn && !showdownReveal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="fixed inset-0 z-[450] pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 120% 90% at 50% 60%, transparent 25%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.85) 100%)',
              }}
            />
          )}
        </AnimatePresence>

        <VisualFeedbackOverlay />

        {/* ═══ PORTALED HEADER ACTIONS ═══ */}
        {headerActionsEl && createPortal(
          <div className="flex items-center gap-1 md:gap-2 h-full pr-2 md:pr-4 border-r border-white/5 mr-2 md:mr-4">
            <button
              onClick={() => { setShowHistory(true); trigger('buttonClick'); }}
              className="p-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
              aria-label="Hand history"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowSettings(true); trigger('buttonClick'); }}
              className="p-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
              aria-label="Feedback settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowLeaveDialog(true); trigger('buttonClick'); }}
              className="p-2 rounded-full hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
              aria-label="Leave table"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>,
          headerActionsEl
        )}

        <FeedbackSettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
        <LeaveTableDialog
          open={showLeaveDialog}
          onClose={() => setShowLeaveDialog(false)}
          onConfirm={handleLeaveTable}
          stackAmount={heroStack}
          isHandInProgress={!!game.handInProgress}
        />
        <HistoryDialog open={showHistory} onClose={() => setShowHistory(false)} tableId={tableId} />
        <BuyInDialog
          open={showRebuyDialog}
          onClose={() => { if (!hasJoined && !isHeroSeated) { navigate({ to: '/lobby' }); } else { setShowRebuyDialog(false); } }}
          onConfirm={(amount) => {
            // Use isHeroSeated to determine if it's a rebuy or initial join
            if (!isHeroSeated) {
              sendJoin(amount);
              setHasJoined(true);
              setIsJoining(true);
            } else {
              sendRebuy(amount);
            }
            setShowRebuyDialog(false);
          }}
          minBuyIn={100}
          maxBuyIn={200000}
          defaultBuyIn={1000}
          isRebuy={isHeroSeated}
          currentBalance={balance}
        />
        <PlayerStatsDialog userId={statsUserId} onOpenChange={(open) => !open && setStatsUserId(null)} />

        {/* MAIN TABLE AREA - pt-16 exactly matches the h-16 (64px) global header. */}
        <div className="absolute inset-0 flex items-center justify-center pt-16 px-3 pb-28 md:pt-16 md:px-4 md:pb-24 z-10">
          {/* Table Wrapper */}
          <div
            className="relative w-full h-full transform-gpu [will-change:transform]"
            style={{ maxWidth: isDesktop ? '1000px' : '500px', transition: 'max-width 0.4s ease' }}
          >
            <TableRail isMobile={!isDesktop} />

            <div className="absolute inset-3 md:inset-10" style={{ transition: 'inset 0.4s ease' }}>
              {/* ═══ ALL-IN TENSION AURA ═══ */}
              <AnimatePresence>
                {isAnyAllIn && !showdownReveal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    // Added explicit transition here to break the infinite loop on exit
                    exit={{ opacity: 0, transition: { duration: 0.3, repeat: 0 } }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 pointer-events-none z-20"
                    style={{
                      borderRadius: isDesktop ? '100px' : '28px',
                      boxShadow: 'inset 0 0 80px 10px rgba(239, 68, 68, 0.4)'
                    }}
                  />
                )}
              </AnimatePresence>

              {/* ═══ HERO CARD SPOTLIGHT (Premium Subtle Breathing) ═══ */}
              <AnimatePresence>
                {isMyTurn && !showdownReveal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.15, 0.3, 0.15], scale: [1, 1.02, 1] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 pointer-events-none z-[442]"
                    style={{
                      background: 'radial-gradient(ellipse 60% 40% at 50% 90%, rgba(78, 222, 163, 0.1) 0%, transparent 70%)'
                    }}
                  />
                )}
              </AnimatePresence>

              <TableFelt isMobile={!isDesktop} />

              {/* Community Cards */}
              <div className="absolute top-[42%] md:top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <CommunityCards
                  cards={displayCommunityCards}
                  isMobile={!isDesktop}
                  revealedCount={displayCommunityCards.length}
                  winningCards={allWinningCards}
                />
              </div>
            </div>

            {/* Analytics strip set to z-30 so it overlays the top of the table perfectly right below the header */}
            <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
              {!showAnalytics && (
                <MobileAnalyticsStrip winProb={winProb} potOdds={potOdds} bestHand={bestHand} strength={strength} />
              )}
            </div>

            {/* POT BADGE - z-30 (Moved down slightly to clear the analytics strip) */}
            <div className={cn(
              "absolute left-1/2 -translate-x-1/2 z-30 transition-[top] duration-700 ease-in-out pointer-events-none",
              showdownReveal
                ? "top-[50px] md:top-[40px]"
                : "top-[70px] md:top-[60px]"
            )}>
              <div className="pointer-events-auto">
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
              isDealing={isDealing}
              onShowStats={setStatsUserId}
            />

            <DealAnimationLayer isDesktop={isDesktop} heroSeat={resolvedHeroSeat} />
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

        {/* ACTION BAR / OBSERVER CONTROLS */}
        {isObserving && !isHeroSeated ? (
          <div className="absolute bottom-0 left-0 right-0 z-[450] pb-[env(safe-area-inset-bottom)] flex justify-center">
            <button
              onClick={() => setShowRebuyDialog(true)}
              className="mb-4 px-8 py-3 md:py-4 bg-tertiary text-on-tertiary font-label-caps text-xs md:text-sm hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg rounded-lg transition-colors"
            >
              Take a Seat
            </button>
          </div>
        ) : (
          <div className="absolute bottom-0 left-0 right-0 z-[450] pb-[env(safe-area-inset-bottom)]">
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
          </div>
        )}

        {showDisconnect && (
          <div className="absolute bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-mono z-[500] border border-white/10">
            {connectionStatus === 'reconnecting' ? '⚡ Reconnecting…' : '⛔ Disconnected'}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
