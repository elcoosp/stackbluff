import { useGameHandCompletion } from '@/hooks/useGameHandCompletion';
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
import { useGameStore, useActiveRoom } from '@stackbluff/shared/stores/gameStore';
import { useDealStore } from '@stackbluff/shared/stores/dealStore';
import { useFeedback } from '@stackbluff/shared/hooks/useFeedback';
import { FeedbackSettingsDialog } from '@stackbluff/shared/components/feedback/FeedbackSettingsDialog';
import { VisualFeedbackOverlay } from '@stackbluff/shared/components/feedback/VisualFeedbackOverlay';
import type { FeedbackEvent } from '@stackbluff/shared/services/feedback/types';
import { ErrorBoundary } from 'react-error-boundary';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Settings, LogOut, History, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { toast } from 'sonner';
import { TournamentHUD } from '../components/tournament/TournamentHUD';
import { BlindLevelNotification } from '../components/tournament/BlindLevelNotification';
import { TournamentResultsModal } from '../components/tournament/TournamentResultsModal';
import { FinalTableBanner } from '../components/tournament/FinalTableBanner';
import { useTournamentStore } from '@stackbluff/shared/stores/tournamentStore';
import type { TournamentResultEntry } from '@stackbluff/shared/types/tournament.types';
import { tournamentApi } from '@stackbluff/shared/api/tournamentApi';

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
  game: ReturnType<typeof useActiveRoom>,
  activeRoomId: string | null,
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
  const prevRoomId = useRef(activeRoomId);

  if (prevRoomId.current !== activeRoomId) {
    prevCommunityLen.current = game.communityCards?.length ?? 0;
    prevShowdown.current = game.showdownReveal;
    prevCurrentTurn.current = game.currentTurnUserId;
    prevSeatActions.current = {};
    prevPot.current = game.pot;
    prevActionRequired.current = !!game.actionRequired;
    prevRoomId.current = activeRoomId;
  }

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
      String(game.currentTurnUserId) !== String(resolvedHeroSeat)
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
  useGameHandCompletion();
  const { tableId } = useParams({ from: '/table/$tableId' });
  const search = useSearch({ from: '/table/$tableId' });
  const navigate = useNavigate();

  const isObserving = (search as any)?.observe === 'true' || (search as any)?.observe === true;
  const tournamentId = (search as any).tournamentId as string | undefined;
  const urlBuyInRaw = (search as any)?.buyIn;
  const urlBuyIn = urlBuyInRaw ? Number(urlBuyInRaw) : undefined;

  const { sendJoin, sendAction, sendRebuy, connectionStatus, myUserId, notSeated, sendLeave } = useGameWebSocket(tableId);
  const isDesktop = useResponsiveLayout();
  const showAnalytics = useMediaQuery('(min-width: 980px)');

  const game = useActiveRoom();
  const activeRoomId = useGameStore(s => s.activeRoomId);

  const rooms = useGameStore(s => s.rooms);
  const roomIds = useMemo(() => Object.keys(rooms), [rooms]);

  const { trigger } = useFeedback();
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showRebuyDialog, setShowRebuyDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [statsUserId, setStatsUserId] = useState<string | null>(null);
  const isTournament = !!tournamentId;
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [resultsData, setResultsData] = useState<TournamentResultEntry[]>([]);
  const [finalTableVisible, setFinalTableVisible] = useState(false);
  const { isDealing } = useDealStore();
  const balance = useAuthStore((s) => s.balance);

  useEffect(() => {
    if (urlBuyIn && urlBuyIn > 0) {
      useGameStore.setState({ rooms: {}, activeRoomId: null });
    }
  }, [urlBuyIn]);

  useEffect(() => {
    if (!tableId) return;
    const matchingEntry = Object.entries(rooms).find(([, r]: [string, any]) => r.tableId === tableId);
    if (matchingEntry) {
      const [rId] = matchingEntry;
      if (activeRoomId !== rId) {
        useGameStore.getState().setActiveRoom(rId);
      }
    }
  }, [rooms, tableId, activeRoomId]);

  useEffect(() => {
    const handleResult = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.tournamentId === tournamentId) {
        setResultsData(detail.results);
        setResultsModalOpen(true);
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          const myResult = detail.results.find((r: any) => r.user_id === userId);
          if (myResult && myResult.prize > 0) {
            useAuthStore.getState().updateBalance(myResult.prize);
          }
        }
      }
    };
    const handleElimination = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.tournamentId === tournamentId) {
        toast.info(`${detail.playerName || 'A player'} eliminated in position ${detail.position || '?'}`);
      }
    };
    const handleFinalTable = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.tournamentId === tournamentId) {
        setFinalTableVisible(true);
      }
    };
    const handleTableChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (tournamentId && detail.tournamentId === tournamentId) {
        const newTableId = detail.newRoomId;
        if (newTableId) {
          navigate({
            to: '/table/$tableId',
            params: { tableId: newTableId },
            search: { tournamentId },
          });
        }
      }
    };

    window.addEventListener('tournament:result', handleResult as EventListener);
    window.addEventListener('tournament:finalTable', handleFinalTable as EventListener);
    window.addEventListener('tournament:elimination', handleElimination as EventListener);
    window.addEventListener('tournament:tableChanged', handleTableChanged as EventListener);

    return () => {
      window.removeEventListener('tournament:result', handleResult as EventListener);
      window.removeEventListener('tournament:finalTable', handleFinalTable as EventListener);
      window.removeEventListener('tournament:elimination', handleElimination as EventListener);
      window.removeEventListener('tournament:tableChanged', handleTableChanged as EventListener);
    };
  }, [tournamentId, navigate]);

  useEffect(() => {
    if (!tournamentId) return;
    const tournamentState = useTournamentStore.getState().tournaments[tournamentId];
    if (tournamentState?.status !== 'Running') return;

    const interval = setInterval(async () => {
      try {
        const data = await tournamentApi.getMyTable(tournamentId);
        if (data.table_id) {
          clearInterval(interval);
          navigate({
            to: '/table/$tableId',
            params: { tableId: data.table_id },
            search: { tournamentId },
          });
        }
      } catch (e) {
        // ignore errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tournamentId, navigate]);

  useEffect(() => {
    useDealStore.setState({ isDealing: false });
  }, [activeRoomId]);

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
    lastAction,
  } = game;

  const potRef = useRef<HTMLDivElement | null>(null);

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

  const isHeroSeated = Object.values(seatsWithShowdown).some((s: any) => s.user_id === myUserId);

  useEffect(() => {
    if (notSeated && !isJoining) {
      setHasJoined(false);
      setShowRebuyDialog(false);
      if (!isObserving) {
        useGameStore.setState({ rooms: {}, activeRoomId: null });
        setShowRebuyDialog(true);
      }
    }
  }, [notSeated, isJoining, isObserving]);

  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    if (isObserving && !isHeroSeated && !hasJoined) {
      setHasJoined(true);
      return;
    }

    if (!isHeroSeated && !hasJoined) {
      if (urlBuyIn && urlBuyIn > 0) {
        sendJoin(urlBuyIn);
        setHasJoined(true);
        setIsJoining(true);
        setShowRebuyDialog(false);
      } else if (!isObserving) {
        setShowRebuyDialog(true);
      }
      return;
    }

    if (isHeroSeated && !hasJoined) {
      setHasJoined(true);
    }
    if (isHeroSeated && showRebuyDialog && !isAddingTable) {
      setShowRebuyDialog(false);
    }
  }, [connectionStatus, isHeroSeated, isObserving, hasJoined, urlBuyIn, sendJoin, showRebuyDialog, isAddingTable]);

  // ─── FIXED REBUY DIALOG LOGIC ──────────────────────────────────────────
  useEffect(() => {
    // Reset joining flag when stack is positive
    if (isJoining && heroStack > 0) {
      setIsJoining(false);
    }

    // Check if hero is currently involved in an active hand (has hole cards)
    const isHeroInActiveHand = game.current_hand_in_progress && heroHoleCards.length > 0;

    const shouldShow =
      hasJoined &&
      heroStack === 0 &&
      !isJoining &&
      connectionStatus === 'connected' &&
      !isObserving &&
      !isTournament &&
      !isHeroInActiveHand; // <-- Replaced !game.current_hand_in_progress

    if (shouldShow) {
      setShowRebuyDialog(true);
    } else if (heroStack > 0 && !isAddingTable) {
      // Close dialog when stack becomes > 0 (e.g., after rebuy)
      setShowRebuyDialog(false);
    }
  }, [
    heroStack,
    connectionStatus,
    hasJoined,
    isJoining,
    game.current_hand_in_progress,
    heroHoleCards, // <-- Added heroHoleCards to dependency array
    isObserving,
    isAddingTable,
    isTournament,
  ]);

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
    sendAction: (action: string, amount?: number) => activeRoomId ? sendAction(activeRoomId, action, amount) : undefined,
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
      const expiresAtMs = heroTimerExpiresAt > 1e12 ? heroTimerExpiresAt : heroTimerExpiresAt * 1000;
      const remaining = Math.max(0, expiresAtMs - now);
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
      const expiresAtMs = opponentTimerExpiresAt > 1e12 ? opponentTimerExpiresAt : opponentTimerExpiresAt * 1000;
      const remaining = Math.max(0, expiresAtMs - now);
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
    activeRoomId,
    resolvedHeroSeat,
    isMyTurn,
    heroTimerRemainingMs,
    heroTimerTotalMs,
  );

  const sendActionWithFeedback = useCallback(
    (action: string, amount?: number) => {
      if (activeRoomId) {
        sendAction(activeRoomId, action, amount);
        

  

  const handleKick = useCallback((targetUserId: string) => {
    if (!activeRoomId) return;
    const room = useGameStore.getState().rooms[activeRoomId];
    if (!room) return;
    // Find the seat of the target user
    let targetSeat = null;
    for (const [seat, player] of Object.entries(room.seats)) {
      if ((player as any).user_id === targetUserId) {
        targetSeat = seat;
        break;
      }
    }
    if (targetSeat === null) return;
    // Send kick vote start
    sendWsMessage('kick_vote_start', {
      room_id: activeRoomId,
      target_player_id: targetUserId,
    });
  }, [activeRoomId, sendWsMessage]);
const handleKick = useCallback((targetUserId: string) => {
    if (!activeRoomId) return;
    const room = useGameStore.getState().rooms[activeRoomId];
    if (!room) return;
    // Find the seat of the target user
    let targetSeat = null;
    for (const [seat, player] of Object.entries(room.seats)) {
      if ((player as any).user_id === targetUserId) {
        targetSeat = seat;
        break;
      }
    }
    if (targetSeat === null) return;
    // Send kick vote start
    sendWsMessage('kick_vote_start', {
      room_id: activeRoomId,
      target_player_id: targetUserId,
    });
  }, [activeRoomId, sendWsMessage]);
const actionToEvent: Record<string, FeedbackEvent> = {
          fold: 'fold', check: 'check', call: 'call',
          bet: 'bet', raise: 'raise', 'all-in': 'allIn',
        };
        const eventType = actionToEvent[action];
        if (eventType) trigger(eventType, { seatIndex: resolvedHeroSeat });
      }
    },
    [sendAction, trigger, resolvedHeroSeat, activeRoomId],
  );

  const handleLeaveTable = useCallback(() => {
    const roomIdToLeave = activeRoomId || roomIds[0];
    if (roomIdToLeave) {
      sendLeave(roomIdToLeave);
      setHasJoined(false);
      if (roomIds.length <= 1) {
        navigate({ to: '/lobby' });
      }
    }
  }, [sendLeave, navigate, activeRoomId, roomIds]);

  const handleAddTable = useCallback(() => {
    setIsAddingTable(true);
    setShowRebuyDialog(true);
  }, []);

  const isAnyAllIn = Object.values(seatsWithShowdown).some(
    (s: any) => s.is_all_in && !s.is_folded
  );

  const headerActionsEl = typeof document !== 'undefined' ? document.getElementById('header-portal-actions') : null;

  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      <div
        className="fixed inset-0 w-full overflow-hidden select-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, #1a1c1b 0%, #111 40%, #0a0a0a 100%)',
        }}
      >
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

        {/* Vertical Glass Morphism Multi-table Rail */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col items-center gap-3">
          {roomIds.map((rId) => (
            <motion.button
              key={rId}
              onClick={() => useGameStore.getState().setActiveRoom(rId)}
              whileTap={{ x: -6, scale: 1.3 }}
              whileHover={{ x: -2 }}
              className={cn(
                "rounded-full backdrop-blur-md border transition-all duration-200",
                rId === activeRoomId
                  ? "w-4 h-4 bg-emerald-500/80 border-white/60 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  : "w-3 h-3 bg-white/15 border-white/30 hover:bg-white/30"
              )}
              aria-label={`Switch to table ${rId.slice(0, 4)}`}
            />
          ))}
          <motion.button
            onClick={handleAddTable}
            whileTap={{ x: -6, scale: 1.2 }}
            whileHover={{ x: -2 }}
            className="w-5 h-5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Add table"
          >
            <Plus className="w-3 h-3" />
          </motion.button>
        </div>

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
          onClose={() => {
            if (isAddingTable) {
              setIsAddingTable(false);
              setShowRebuyDialog(false);
            } else if (!hasJoined && !isHeroSeated) {
              navigate({ to: '/lobby' });
            } else {
              setShowRebuyDialog(false);
            }
          }}
          onConfirm={(amount) => {
            if (isAddingTable) {
              sendJoin(amount);
              setIsAddingTable(false);
            } else if (!isHeroSeated) {
              sendJoin(amount);
              setHasJoined(true);
              setIsJoining(true);
            } else if (activeRoomId) {
              sendRebuy(activeRoomId, amount);
            }
            setShowRebuyDialog(false);
          }}
          minBuyIn={100}
          maxBuyIn={200000}
          defaultBuyIn={1000}
          isRebuy={isHeroSeated && !isAddingTable}
          currentBalance={balance}
        />
        <PlayerStatsDialog userId={statsUserId} onOpenChange={(open) => !open && setStatsUserId(null)} />

        <div className="absolute inset-0 flex items-center justify-center pt-16 px-3 pb-28 md:pt-16 md:px-4 md:pb-24 z-10">
          <div
            className="relative w-full h-full transform-gpu [will-change:transform]"
            style={{ maxWidth: isDesktop ? '1000px' : '500px', transition: 'max-width 0.4s ease' }}
          >
            <TableRail isMobile={!isDesktop} />

            <div className="absolute inset-3 md:inset-10" style={{ transition: 'inset 0.4s ease' }}>
              <AnimatePresence>
                {isAnyAllIn && !showdownReveal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
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

              {tournamentId && (
                <div className="absolute top-4 right-4 z-[460]">
                  <TournamentHUD tournamentId={tournamentId} isMobile={!isDesktop} heroStack={heroStack} />
                </div>
              )}
              {tournamentId && <BlindLevelNotification tournamentId={tournamentId} />}
              <FinalTableBanner visible={finalTableVisible} />
              <TableFelt isMobile={!isDesktop} />

              <div className="absolute top-[42%] md:top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <CommunityCards
                  cards={displayCommunityCards}
                  isMobile={!isDesktop}
                  revealedCount={displayCommunityCards.length}
                  winningCards={allWinningCards}
                />
              </div>
            </div>

            <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
              {!showAnalytics && (
                <MobileAnalyticsStrip winProb={winProb} potOdds={potOdds} bestHand={bestHand} strength={strength} />
              )}
            </div>

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
                  potRef={potRef as React.RefObject<HTMLDivElement>}
                  lastAction={lastAction}
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

            <DealAnimationLayer
              key={`deal-${activeRoomId}`}
              isDesktop={isDesktop}
              heroSeat={resolvedHeroSeat}
              heroHoleCards={heroHoleCards ? [...heroHoleCards] : []}
              communityCards={displayCommunityCards}
              seats={seatsWithShowdown}
            />
            <BetAnimationLayer
              key={`bet-${activeRoomId}`}
              isDesktop={isDesktop}
              heroSeat={resolvedHeroSeat}
              lastAction={lastAction}
              seats={seatsWithShowdown}
            />

            {showdownMorphComplete && (
              <ChipAnimationLayer
                key={`chip-${activeRoomId}`}
                isDesktop={isDesktop}
                heroSeat={resolvedHeroSeat}
                potRef={potRef as React.RefObject<HTMLDivElement>}
                showdownReveal={showdownReveal}
              />
            )}
          </div>
        </div>

        {showAnalytics && (
          <>
            <TacticalOracle winProb={winProb} potOdds={potOdds} />
            <HandStrength bestHand={bestHand} strength={strength} />
          </>
        )}

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
