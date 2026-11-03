/**
 * TableScene — native composition of PWA `pages/TablePage.tsx` (render tree
 * + interaction wiring; the socket layer is injected via the `ws` prop from
 * the table route).
 *
 * Layers (z-order mirrors the PWA DOM):
 *   my-turn vignette overlay → background radial glow → header actions →
 *   multi-table rail (room dots) → dialog layer → the table container
 *   (max-w 500/1000) holding NativeTableRail, the felt inset (all-in glow,
 *   my-turn felt pulse, club tint, NativeTableFelt, CommunityCards),
 *   MobileAnalyticsStrip / TacticalOracle+HandStrength, PotBadge, SeatGrid
 *   (hero-rotated via getPositionIndex + positionToStyle), the deal/bet/
 *   chip animation layers, the bottom ActionBar (or Take-a-Seat) and the
 *   disconnect pill.
 *
 * Ported 1:1 from TablePage: join/rebuy/notSeated flows, F-16/F-8/F-20/
 * F-11 fixes, pre-action hook, seat-aware feedback (incl. timer level
 * crossings through useTurnCountdown's onLevel), kick-vote custom events
 * (wsCompat bus) and the showdown pot-morph delay. Tournament HUD widgets
 * (TournamentHUD / BlindLevelNotification / FinalTableBanner) stay PWA-only
 * — they are tournament-screen components outside the 3-a lane.
 */

import { useFeedback } from '@stackbluff/shared/src/hooks/useFeedback';
import type { FeedbackEvent } from '@stackbluff/shared/src/services/feedback/types';
import { useDealStore } from '@stackbluff/shared/src/stores/dealStore';
import {
  type GameRoomState,
  type Seat,
  useActiveRoom,
  useGameStore,
} from '@stackbluff/shared/src/stores/gameStore';
import {
  NativeTableFelt,
  NativeTableRail,
  TABLE_ANCHORS,
  useTableViewport,
} from '@stackbluff/ui-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAuthStore } from '../../stores/authStore';
import { ActionBar } from './ActionBar';
import { HandStrength, MobileAnalyticsStrip, TacticalOracle } from './AnalyticsPanel';
import { BetAnimationLayer } from './animations/BetAnimationLayer';
import { ChipAnimationLayer } from './animations/ChipAnimationLayer';
import { DealAnimationLayer } from './animations/DealAnimationLayer';
import { CommunityCards } from './CommunityCards';
import { useClubFeltTint } from './clubTheme';
import { BuyInDialog } from './dialogs/BuyInDialog';
import { HistoryDialog } from './dialogs/HistoryDialog';
import { KickVoteDialog } from './dialogs/KickVoteDialog';
import { LeaveTableDialog } from './dialogs/LeaveTableDialog';
import { PlayerStatsDialog } from './dialogs/PlayerStatsDialog';
import { HistoryIcon, LoaderIcon, LogOutIcon, PlusIcon } from './icons';
import { PotBadge } from './PotBadge';
import { SeatGrid } from './SeatGrid';
import { useGameFeedback } from './useGameFeedback';
import { usePreAction } from './usePreAction';
import { useTurnCountdown } from './useTurnTimer';
import { onSharedEvent } from './wsCompat';

/* ── Socket surface injected by the route (shared useGameWebSocket) ─────── */
export interface TableSceneSocket {
  sendJoin: (amount: number) => void;
  sendAction: (roomId: string, action: string, amount?: number) => void;
  sendRebuy: (roomId: string, amount: number) => void;
  sendWsMessage: (type: string, payload: Record<string, unknown>) => void;
  sendLeave: (roomId: string) => void;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  myUserId: string | null;
  notSeated: boolean;
}

export interface TableSceneProps {
  tableId: string;
  ws: TableSceneSocket;
  /** Route `?observe=true`. */
  isObserving?: boolean;
  /** Route `?tournamentId=` — tournaments never auto-join/rebuy. */
  tournamentId?: string | null;
  /** Route `?buyIn=` — auto join with this amount once connected. */
  urlBuyIn?: number | null;
  /** Active club id → felt tint (clubTheme store). */
  clubId?: string | null;
  /** Fired after leaving the last room (route navigates back). */
  onLeave?: () => void;
}

/* ══════════════════════════════════════════════════════════════════════════
   Small building blocks
   ══════════════════════════════════════════════════════════════════════════ */

/** Framer radial-gradient backgrounds → SVG radial fills (RN has no CSS
 * gradients). Stretched to the container via viewBox + preserveAspectRatio. */
function RadialBackground({ style }: { style?: object }) {
  return (
    <Svg pointerEvents="none" style={style}>
      <Defs>
        <RadialGradient id="sceneBg" cx="0.5" cy="0.4" rx="0.75" ry="0.6">
          <Stop offset="0" stopColor="#1a1c1b" />
          <Stop offset="0.4" stopColor="#111111" />
          <Stop offset="1" stopColor="#0a0a0a" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#sceneBg)" />
    </Svg>
  );
}

function TurnVignette({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: 400,
      easing: Easing.inOut(Easing.ease),
    });
  }, [visible, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 450 }, style]}
    >
      <Svg style={{ flex: 1 }}>
        <Defs>
          <RadialGradient id="turnVignette" cx="0.5" cy="0.6" rx="0.6" ry="0.45">
            <Stop offset="0.25" stopColor="#000000" stopOpacity="0" />
            <Stop offset="0.7" stopColor="#000000" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.85" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#turnVignette)" />
      </Svg>
    </Animated.View>
  );
}

/** All-in felt ring — inset 0 0 80px 10px red glow emulated with nested
 * border rings, opacity [0.3, 0.7, 0.3] 1.5s loop (PWA AnimatePresence). */
function AllInGlow({ visible, isMobile }: { visible: boolean; isMobile: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 750, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [visible, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const radius = isMobile ? 28 : 100;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }, style]}
    >
      {/* three nested 1px rings ≈ inset 80px blur / 10px spread */}
      {[0, 10, 22].map((inset, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: ring index is the identity
          key={`glow-ring-${i}`}
          style={{
            position: 'absolute',
            top: inset,
            left: inset,
            right: inset,
            bottom: inset,
            borderRadius: radius - inset,
            borderWidth: 2 + i * 2,
            borderColor: `rgba(239,68,68,${0.16 - i * 0.04})`,
          }}
        />
      ))}
    </Animated.View>
  );
}

/** My-turn felt glow — radial emerald pulse at 50% 90%, opacity
 * [0.15, 0.3, 0.15] + scale [1, 1.02, 1], 4s ease-in-out loop. */
function MyTurnFeltGlow({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (visible) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.15, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      opacity.value = withTiming(0, { duration: 400 });
      scale.value = withTiming(1, { duration: 400 });
    }
  }, [visible, opacity, scale]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 442 }, style]}
    >
      <Svg style={{ flex: 1 }}>
        <Defs>
          <RadialGradient id="turnGlow" cx="0.5" cy="0.9" rx="0.3" ry="0.2">
            <Stop offset="0" stopColor="#4edea3" stopOpacity="0.1" />
            <Stop offset="0.7" stopColor="#4edea3" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#turnGlow)" />
      </Svg>
    </Animated.View>
  );
}

/** useDelayedBoolean — TablePage helper (showdown pot-morph gate). */
function useDelayedBoolean(value: boolean, delayMs: number): boolean {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (value) {
      const timer = setTimeout(() => setDelayed(true), delayMs);
      return () => clearTimeout(timer);
    }
    setDelayed(false);
  }, [value, delayMs]);
  return delayed;
}

/* ══════════════════════════════════════════════════════════════════════════
   TableScene
   ══════════════════════════════════════════════════════════════════════════ */

interface KickVoteState {
  roomId: string;
  kickVoteId: string;
  targetId: string;
  targetName: string;
  durationSecs: number;
  requiredVotes: number;
  initiatorId: string;
}

export function TableScene({
  tableId,
  ws,
  isObserving = false,
  tournamentId = null,
  urlBuyIn = null,
  clubId = null,
  onLeave,
}: TableSceneProps) {
  const { sendJoin, sendAction, sendRebuy, sendWsMessage, sendLeave } = ws;
  const { connectionStatus, myUserId, notSeated } = ws;
  const { trigger } = useFeedback();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useTableViewport();
  const isDesktop = windowWidth >= 768 && windowHeight >= 500;

  const game = useActiveRoom();
  const activeRoomId = useGameStore((s) => s.activeRoomId);
  // F-8 FIX: read the current room's big blind from the store.
  const bigBlind = useGameStore((s) =>
    s.activeRoomId ? (s.rooms[s.activeRoomId]?.bigBlind ?? 10) : 10,
  );

  const rooms = useGameStore((s) => s.rooms);
  const roomIds = useMemo(() => Object.keys(rooms), [rooms]);

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showRebuyDialog, setShowRebuyDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [statsUserId, setStatsUserId] = useState<string | null>(null);
  const [kickVoteDialog, setKickVoteDialog] = useState<KickVoteState | null>(null);
  const isTournament = !!tournamentId;
  const { isDealing } = useDealStore();
  const balance = useAuthStore((s) => s.balance);
  const feltTint = useClubFeltTint(clubId);

  useEffect(() => {
    // TablePage mount parity: clear a stale dealing flag.
    useDealStore.setState({ isDealing: false });
  }, []);

  /* ── urlBuyIn: reset only this table's room (F-16) ───────────────────── */
  useEffect(() => {
    if (urlBuyIn && urlBuyIn > 0) {
      const store = useGameStore.getState();
      const match = Object.entries(store.rooms).find(
        ([, r]) => (r as GameRoomState).tableId === tableId,
      );
      if (match) {
        const [rid] = match;
        store.removeRoom(rid);
        if (store.activeRoomId === rid) {
          useGameStore.setState({ activeRoomId: null });
        }
      }
    }
  }, [urlBuyIn, tableId]);

  /* ── Sync active room to this table ──────────────────────────────────── */
  useEffect(() => {
    if (!tableId) return;
    const matchingEntry = Object.entries(rooms).find(
      ([, r]) => (r as GameRoomState).tableId === tableId,
    );
    if (matchingEntry) {
      const [rId] = matchingEntry;
      if (activeRoomId !== rId) {
        useGameStore.getState().setActiveRoom(rId);
      }
    }
  }, [rooms, tableId, activeRoomId]);

  /* ── Derived game state (TablePage 1:1) ─────────────────────────────── */
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

  const winProb = analytics?.winProb ?? 0;
  const potOdds = analytics?.potOdds ?? 0;
  const bestHand = analytics?.bestHand ?? '—';
  const strength = analytics?.strength ?? 0;

  const heroSeatByUserId = myUserId
    ? Object.entries(seats).find(([, s]) => (s as Seat).user_id === myUserId)
    : null;
  const resolvedHeroSeat: number = heroSeatByUserId ? Number(heroSeatByUserId[0]) : (heroSeat ?? 0);

  const seatsWithHeroCards: Record<number, Seat> = { ...seats };
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
        hole_cards: heroHoleCards,
      };
    }
  }

  const seatsWithShowdown: Record<number, Seat> = { ...seatsWithHeroCards };
  if (showdownReveal) {
    for (const player of showdownReveal.players) {
      const seatIndex = player.seat;
      if (seatsWithShowdown[seatIndex]) {
        const shouldRevealCards = player.hole_cards && player.hole_cards.length > 0;
        seatsWithShowdown[seatIndex] = {
          ...seatsWithShowdown[seatIndex],
          hole_cards: shouldRevealCards
            ? player.hole_cards
            : seatsWithShowdown[seatIndex].hole_cards,
          hand_description: player.hand_description,
          is_winner: player.is_winner,
          win_amount: player.win_amount,
          winning_cards: player.winning_cards,
          is_showdown_revealed: true,
        };
      }
    }
  }

  const displayCommunityCards = showdownReveal?.community_cards?.length
    ? showdownReveal.community_cards
    : communityCards;

  const allWinningCards = showdownReveal?.players.flatMap((p) => p.winning_cards || []) || [];

  const isMyTurn = !!actionRequired;
  const toCall = actionRequired?.to_call ?? 0;
  const minRaiseDelta = actionRequired?.min_raise ?? 0;
  const potForAction = actionRequired?.pot ?? pot;

  const heroStack = seatsWithShowdown[resolvedHeroSeat]?.stack || 0;
  const minRaiseAmount = toCall + minRaiseDelta;
  const canRaise = heroStack >= minRaiseAmount;
  const maxRaiseAmount = heroStack > 0 ? heroStack : minRaiseAmount;
  const finalMinRaise = canRaise ? minRaiseAmount : maxRaiseAmount;

  const isHeroSeated = Object.values(seatsWithShowdown).some((s) => s.user_id === myUserId);
  const isAnyAllIn = Object.values(seatsWithShowdown).some((s) => s.is_all_in && !s.is_folded);

  /* ── notSeated handling ──────────────────────────────────────────────── */
  useEffect(() => {
    if (notSeated && !isJoining) {
      setHasJoined(false);
      setShowRebuyDialog(false);
      if (!isObserving) {
        // F-16 FIX (second site): reset only the room we're sitting at.
        const store = useGameStore.getState();
        const match = Object.entries(store.rooms).find(
          ([, r]) => (r as GameRoomState).tableId === tableId,
        );
        if (match) {
          const [rid] = match;
          store.removeRoom(rid);
          if (store.activeRoomId === rid) {
            useGameStore.setState({ activeRoomId: null });
          }
        }
        // Cash games only — tournaments wait for table assignment.
        if (!isTournament) {
          setShowRebuyDialog(true);
        }
      }
    }
  }, [notSeated, isJoining, isObserving, isTournament, tableId]);

  /* ── Join / seating ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    if (isObserving && !isHeroSeated && !hasJoined) {
      setHasJoined(true);
      return;
    }

    if (isTournament && !isHeroSeated && !hasJoined) {
      setHasJoined(true);
      setShowRebuyDialog(false);
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
  }, [
    connectionStatus,
    isHeroSeated,
    isObserving,
    hasJoined,
    urlBuyIn,
    sendJoin,
    showRebuyDialog,
    isAddingTable,
    isTournament,
  ]);

  /* ── Rebuy logic ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (isJoining && heroStack > 0) {
      setIsJoining(false);
    }

    const isHeroInActiveHand = game.handInProgress && (heroHoleCards?.length ?? 0) > 0;

    const shouldShow =
      hasJoined &&
      heroStack === 0 &&
      !isJoining &&
      connectionStatus === 'connected' &&
      !isObserving &&
      !isTournament && // Disable rebuy for tournaments
      !isHeroInActiveHand;

    if (shouldShow) {
      setShowRebuyDialog(true);
    } else if (heroStack > 0 && !isAddingTable) {
      setShowRebuyDialog(false);
    }
  }, [
    heroStack,
    connectionStatus,
    hasJoined,
    isJoining,
    game.handInProgress,
    heroHoleCards,
    isObserving,
    isAddingTable,
    isTournament,
  ]);

  /* ── Disconnect pill ─────────────────────────────────────────────────── */
  const [showDisconnect, setShowDisconnect] = useState(false);
  useEffect(() => {
    if (connectionStatus !== 'connected') {
      const timer = setTimeout(() => setShowDisconnect(true), 1500);
      return () => clearTimeout(timer);
    }
    setShowDisconnect(false);
  }, [connectionStatus]);

  /* ── Pre-action ──────────────────────────────────────────────────────── */
  const { preAction, togglePreAction, executingAction } = usePreAction({
    isMyTurn,
    toCall,
    sendAction: (action: string, amount?: number) =>
      activeRoomId ? sendAction(activeRoomId, action, amount) : undefined,
  });

  const showdownMorphComplete = useDelayedBoolean(!!showdownReveal, 400);

  /* ── Timers (Reanimated shared values — F-20 port) ──────────────────── */
  const onTimerLevel = useCallback(
    (level: 'safe' | 'urgent' | 'final') => {
      if (level === 'urgent') trigger('timerUrgent', { seatIndex: resolvedHeroSeat });
      if (level === 'final') trigger('timerFinal', { seatIndex: resolvedHeroSeat });
    },
    [trigger, resolvedHeroSeat],
  );
  const heroCountdown = useTurnCountdown(
    actionRequired?.expires_at ?? null,
    actionRequired?.timeout_ms ?? null,
    onTimerLevel,
  );

  const opponentTurnUserId = !isMyTurn && currentTurnUserId ? currentTurnUserId : null;
  const opponentTimerExpiresAt = opponentTurnUserId ? currentTurnExpiresAt : null;
  const opponentTimerTotalMs = opponentTurnUserId ? (currentTurnTimeoutMs ?? 30000) : null;
  const opponentCountdown = useTurnCountdown(opponentTimerExpiresAt, opponentTimerTotalMs);

  /* ── Seat-aware feedback ─────────────────────────────────────────────── */
  useGameFeedback({ game, activeRoomId, resolvedHeroSeat, isMyTurn });

  /* ── Actions ─────────────────────────────────────────────────────────── */
  const sendActionWithFeedback = useCallback(
    (action: string, amount?: number) => {
      if (activeRoomId) {
        sendAction(activeRoomId, action, amount);
        const actionToEvent: Record<string, FeedbackEvent> = {
          fold: 'fold',
          check: 'check',
          call: 'call',
          bet: 'bet',
          raise: 'raise',
          'all-in': 'allIn',
        };
        const eventType = actionToEvent[action];
        if (eventType) trigger(eventType, { seatIndex: resolvedHeroSeat });
      }
    },
    [sendAction, trigger, resolvedHeroSeat, activeRoomId],
  );

  // F-11 FIX port: wired to SeatGrid → PlayerSpot's sitting-out kick button.
  const handleKick = useCallback(
    (targetUserId: string) => {
      if (!activeRoomId) return;
      const room = useGameStore.getState().rooms[activeRoomId];
      if (!room) return;
      let targetSeat: string | null = null;
      for (const [seat, player] of Object.entries(room.seats)) {
        if (player.user_id === targetUserId) {
          targetSeat = seat;
          break;
        }
      }
      if (targetSeat === null) return;
      sendWsMessage('kick_vote_start', {
        room_id: activeRoomId,
        target_player_id: targetUserId,
      });
    },
    [activeRoomId, sendWsMessage],
  );

  const handleLeaveTable = useCallback(() => {
    const roomIdToLeave = activeRoomId || roomIds[0];
    if (roomIdToLeave) {
      sendLeave(roomIdToLeave);
      setHasJoined(false);
      if (roomIds.length <= 1) {
        onLeave?.();
      }
    }
    setShowLeaveDialog(false);
  }, [sendLeave, onLeave, activeRoomId, roomIds]);

  const handleAddTable = useCallback(() => {
    setIsAddingTable(true);
    setShowRebuyDialog(true);
  }, []);

  /* ── Kick vote events (wsCompat bus — PWA window CustomEvents) ──────── */
  const kickVoteDialogRef = useRef<KickVoteState | null>(null);
  useEffect(() => {
    kickVoteDialogRef.current = kickVoteDialog;
  }, [kickVoteDialog]);

  useEffect(() => {
    const unsubscribeStarted = onSharedEvent('kickVoteStarted', (detail) => {
      const d = detail as {
        room_id?: string;
        kick_vote_id?: string;
        target_id?: string;
        duration_secs?: number;
        required_votes?: number;
        initiator_id?: string;
      } | null;
      if (!d?.kick_vote_id) return;
      // Try to resolve target name from seats
      let targetName = 'Player';
      const activeId = useGameStore.getState().activeRoomId;
      if (activeId) {
        const room = useGameStore.getState().rooms[activeId];
        if (room) {
          for (const seat of Object.values(room.seats)) {
            if (seat.user_id === d.target_id) {
              targetName = seat.display_name || 'Player';
              break;
            }
          }
        }
      }
      setKickVoteDialog({
        roomId: d.room_id ?? '',
        kickVoteId: d.kick_vote_id,
        targetId: d.target_id ?? '',
        targetName,
        durationSecs: d.duration_secs ?? 0,
        requiredVotes: d.required_votes ?? 0,
        initiatorId: d.initiator_id ?? '',
      });
    });

    const unsubscribeUpdate = onSharedEvent('kickVoteUpdate', (detail) => {
      // KickVoteDialog listens to the same event and manages its own vote
      // state (PWA parity — TablePage's handler only tracked the payload).
      void detail;
    });

    const unsubscribeRemoved = onSharedEvent('playerRemoved', (detail) => {
      const d = detail as { player_id?: string } | null;
      const current = kickVoteDialogRef.current;
      if (current && current.targetId === d?.player_id) {
        setKickVoteDialog(null);
      }
    });

    return () => {
      unsubscribeStarted();
      unsubscribeUpdate();
      unsubscribeRemoved();
    };
  }, []);

  /* ── Back-leave confirm (route-level requirement, handled here so the
      LeaveTableDialog stays owned by one component): while the hero is
      seated, hardware back opens the confirm dialog instead of leaving. ── */
  useEffect(() => {
    if (!isHeroSeated) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowLeaveDialog(true);
      return true;
    });
    return () => sub.remove();
  }, [isHeroSeated]);

  /* ── Layout metrics ──────────────────────────────────────────────────── */
  const isShortHeight = windowHeight <= 720;
  const showAnalytics = windowWidth >= 980;
  const feltInset = isDesktop ? TABLE_ANCHORS.feltInset.desktop : TABLE_ANCHORS.feltInset.mobile;
  const containerMaxWidth = isDesktop
    ? TABLE_ANCHORS.containerMaxWidth.desktop
    : TABLE_ANCHORS.containerMaxWidth.mobile;

  const potTop = showdownReveal ? (isShortHeight ? 25 : 50) : isShortHeight ? 45 : 70;

  const isObservingSeatFlow = isObserving && !isHeroSeated;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      {/* Radial scene background */}
      <RadialBackground style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* My-turn vignette */}
      <TurnVignette visible={isMyTurn && !showdownReveal} />

      {/* ── Header actions (PWA header portal row) ── */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          right: 12,
          zIndex: 1000,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <HeaderButton
          onPress={() => {
            setShowHistory(true);
            trigger('buttonClick');
          }}
          accessibilityLabel="Hand history"
        >
          <HistoryIcon size={16} color="#a1a1aa" />
        </HeaderButton>
        <HeaderButton
          danger
          onPress={() => {
            setShowLeaveDialog(true);
            trigger('buttonClick');
          }}
          accessibilityLabel="Leave table"
        >
          <LogOutIcon size={16} color="#a1a1aa" />
        </HeaderButton>
      </View>

      {/* ── Vertical multi-table rail (room dots) ── */}
      {roomIds.length > 0 && (
        <View
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            zIndex: 1000,
            alignItems: 'center',
            gap: 12,
          }}
        >
          {roomIds.map((rId) => {
            const active = rId === activeRoomId;
            return (
              <Pressable
                key={rId}
                onPress={() => useGameStore.getState().setActiveRoom(rId)}
                accessibilityLabel={`Switch to table ${rId.slice(0, 4)}`}
                style={{
                  width: active ? 16 : 12,
                  height: active ? 16 : 12,
                  borderRadius: 999,
                  backgroundColor: active ? 'rgba(16,185,129,0.8)' : 'rgba(255,255,255,0.15)',
                  borderWidth: 1,
                  borderColor: active ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
                  shadowColor: '#10b981',
                  shadowOpacity: active ? 0.5 : 0,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: active ? 4 : 0,
                }}
              />
            );
          })}
          <Pressable
            onPress={handleAddTable}
            accessibilityLabel="Add table"
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.4)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlusIcon size={12} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>
      )}

      {/* ── Dialog layer ── */}
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
            setShowRebuyDialog(false);
            onLeave?.();
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
      <PlayerStatsDialog
        userId={statsUserId}
        onOpenChange={(open) => !open && setStatsUserId(null)}
      />

      {/* ── Table area ── */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          paddingTop: 64 + insets.top,
          paddingHorizontal: isDesktop ? 16 : 12,
          paddingBottom: (isDesktop ? 96 : 112) + insets.bottom,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            maxWidth: containerMaxWidth,
          }}
        >
          {/* Rail (z0) */}
          <NativeTableRail isMobile={!isDesktop} />

          {/* Felt inset container (inset-3 mobile / inset-10 desktop) */}
          <View
            style={{
              position: 'absolute',
              top: feltInset,
              left: feltInset,
              right: feltInset,
              bottom: feltInset,
            }}
          >
            <AllInGlow visible={isAnyAllIn && !showdownReveal} isMobile={!isDesktop} />
            <MyTurnFeltGlow visible={isMyTurn && !showdownReveal} />

            {/* Felt (z1) — rail/felt render as absolute fills */}
            <NativeTableFelt isMobile={!isDesktop} />

            {/* Club felt tint (clubTheme store — data-club-felt port) */}
            {feltTint && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: isDesktop ? 100 : 28,
                  backgroundColor: feltTint,
                  opacity: 0.18,
                }}
              />
            )}

            {/* Community cards — top 42% mobile / 40% desktop, centered */}
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: isDesktop
                  ? TABLE_ANCHORS.communityCardsTop.desktop
                  : TABLE_ANCHORS.communityCardsTop.mobile,
                left: '50%',
                zIndex: 10,
                transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
              }}
            >
              <CommunityCards
                cards={displayCommunityCards}
                containerWidth={windowWidth || 390}
                revealedCount={displayCommunityCards.length}
                winningCards={allWinningCards}
              />
            </View>
          </View>

          {/* Mobile analytics strip (top, when < 980px) */}
          {!showAnalytics && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 }}>
              <MobileAnalyticsStrip
                winProb={winProb}
                potOdds={potOdds}
                bestHand={bestHand}
                strength={strength}
              />
            </View>
          )}

          {/* Pot badge — 70px / 45px (25/50 during showdown) */}
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: potTop,
              left: '50%',
              zIndex: 30,
              transform: [{ translateX: '-50%' }],
            }}
          >
            <PotBadge
              amount={pot}
              toCall={actionRequired?.to_call}
              isMobile={!isDesktop}
              showdownReveal={showdownReveal}
              lastAction={lastAction}
              sidePots={game.sidePots}
            />
          </View>

          {/* Seats — 9 anchors with hero rotation */}
          <SeatGrid
            seats={seatsWithShowdown}
            heroSeat={resolvedHeroSeat}
            isDesktop={isDesktop}
            containerWidth={windowWidth || 390}
            heroTimerProgress={isMyTurn ? heroCountdown.progress : null}
            opponentTimerProgress={opponentTurnUserId ? opponentCountdown.progress : null}
            opponentTurnUserId={opponentTurnUserId}
            isDealing={isDealing}
            onShowStats={setStatsUserId}
            onKick={handleKick}
          />

          {/* Animation layers */}
          <DealAnimationLayer
            key={`deal-${activeRoomId ?? 'none'}`}
            isDesktop={isDesktop}
            heroSeat={resolvedHeroSeat}
            heroHoleCards={heroHoleCards ? [...heroHoleCards] : []}
            communityCards={displayCommunityCards}
            seats={seatsWithShowdown}
          />
          <BetAnimationLayer
            key={`bet-${activeRoomId ?? 'none'}`}
            isDesktop={isDesktop}
            heroSeat={resolvedHeroSeat}
            lastAction={lastAction}
            seats={seatsWithShowdown}
          />
          {showdownMorphComplete && (
            <ChipAnimationLayer
              key={`chip-${activeRoomId ?? 'none'}`}
              isDesktop={isDesktop}
              heroSeat={resolvedHeroSeat}
              showdownReveal={showdownReveal}
            />
          )}
        </View>
      </View>

      {/* Desktop analytics panels (≥980px — landscape tablets) */}
      {showAnalytics && (
        <>
          <TacticalOracle winProb={winProb} potOdds={potOdds} />
          <HandStrength bestHand={bestHand} strength={strength} />
        </>
      )}

      {/* ── Bottom bar ── */}
      {isObservingSeatFlow ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 450,
            paddingBottom: insets.bottom,
            alignItems: 'center',
          }}
        >
          {isTournament ? (
            <View
              style={{
                marginBottom: 16,
                paddingHorizontal: 32,
                paddingVertical: isDesktop ? 16 : 12,
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <LoaderIcon size={20} color="#4edea3" />
              <Text
                style={{
                  fontSize: 14,
                  color: '#e2e2e2',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Waiting for tournament to start...
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowRebuyDialog(true)}
              style={{
                marginBottom: 16,
                paddingHorizontal: 32,
                paddingVertical: isDesktop ? 16 : 12,
                backgroundColor: '#4edea3',
                borderRadius: 8,
                shadowColor: '#000000',
                shadowOpacity: 0.3,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}
            >
              <Text
                style={{
                  color: '#003824',
                  fontSize: 12,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                }}
              >
                Take a Seat
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 450,
            paddingBottom: insets.bottom,
          }}
        >
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
            heroTimerRemainingMs={heroCountdown.remainingMs.value}
            heroTimerTotalMs={actionRequired?.timeout_ms ?? 30000}
            canRaise={canRaise}
            heroStack={heroStack}
            bigBlind={bigBlind}
            onFeedback={(event, amount, volume) => {
              if (event === 'sliderTick') trigger('sliderTick');
              else if (event === 'sliderConfirm') trigger('sliderConfirm');
              else trigger(event === 'raise' ? 'raise' : 'buttonClick', { volume });
              void amount;
            }}
          />
        </View>
      )}

      {/* Disconnect pill */}
      {showDisconnect && (
        <View
          style={{
            position: 'absolute',
            bottom: isDesktop ? 32 : 96,
            left: '50%',
            zIndex: 500,
            transform: [{ translateX: '-50%' }],
            backgroundColor: 'rgba(0,0,0,0.8)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 14 }}>
            {connectionStatus === 'reconnecting' ? '⚡ Reconnecting…' : '⛔ Disconnected'}
          </Text>
        </View>
      )}

      {/* Kick vote (PWA renders it outside the scene root — Modal layer) */}
      <KickVoteDialog
        open={!!kickVoteDialog}
        onClose={() => setKickVoteDialog(null)}
        initiatorId={kickVoteDialog?.initiatorId || ''}
        targetName={kickVoteDialog?.targetName || 'Player'}
        kickVoteId={kickVoteDialog?.kickVoteId || ''}
        durationSecs={kickVoteDialog?.durationSecs || 0}
        requiredVotes={kickVoteDialog?.requiredVotes || 0}
        onVoteYes={(kickVoteId) => {
          if (activeRoomId) {
            sendWsMessage('kick_vote_yes', {
              room_id: activeRoomId,
              kick_vote_id: kickVoteId,
            });
          }
        }}
        onTimeout={() => setKickVoteDialog(null)}
      />
    </View>
  );
}

/* ── Header action button ────────────────────────────────────────────────── */
function HeaderButton({
  onPress,
  children,
  danger,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: ReactNode;
  danger?: boolean;
  accessibilityLabel: string;
}) {
  const pressed = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ opacity: pressed.value }));
  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withTiming(0.6, { duration: 100 });
        }}
        onPressOut={() => {
          pressed.value = withTiming(1, { duration: 150 });
        }}
        accessibilityLabel={accessibilityLabel}
        style={{
          padding: 8,
          borderRadius: 999,
          backgroundColor: danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
