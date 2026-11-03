/**
 * Seat-aware feedback wiring — 1:1 port of TablePage's `useGameFeedback`.
 *
 * Fires the same FeedbackEvents at the same store transitions through the
 * shared `useFeedback()` hook (which routes to the platform surface, so on
 * native this drives expo-haptics + the audio backend injected by A6):
 *   - community card growth: dealCommunity (flop) / cardDeal (turn+river)
 *   - showdown reveal: showdown + win/lose + potCollect (400ms later)
 *   - action required on hero: notification
 *   - turn moving to another seat: chipClink (spatial pan by seat)
 *   - per-seat action text changes: check/call/bet/raise/fold/allIn
 *   - pot jump > 50%: roundStart
 *   - hero timer level crossings: timerUrgent / timerFinal (wired by the
 *     countdown hook in TableScene)
 */

import { useFeedback } from '@stackbluff/shared/src/hooks/useFeedback';
import type { FeedbackEvent } from '@stackbluff/shared/src/services/feedback/types';
import type { GameRoomState, Seat } from '@stackbluff/shared/src/stores/gameStore';
import { useCallback, useEffect, useRef } from 'react';

interface UseGameFeedbackParams {
  game: GameRoomState;
  activeRoomId: string | null;
  resolvedHeroSeat: number;
  isMyTurn: boolean;
}

const ACTION_TO_EVENT: Record<string, FeedbackEvent> = {
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',
  FOLD: 'fold',
  'ALL-IN': 'allIn',
};

export function useGameFeedback({
  game,
  activeRoomId,
  resolvedHeroSeat,
  isMyTurn,
}: UseGameFeedbackParams) {
  const { trigger } = useFeedback();

  const prevCommunityLen = useRef(0);
  const prevShowdown = useRef(game.showdownReveal);
  const prevCurrentTurn = useRef(game.currentTurnUserId);
  const prevSeatActions = useRef<Record<number, string>>({});
  const prevPot = useRef(game.pot);
  const prevActionRequired = useRef(false);
  const prevRoomId = useRef(activeRoomId);

  if (prevRoomId.current !== activeRoomId) {
    prevCommunityLen.current = game.communityCards?.length ?? 0;
    prevShowdown.current = game.showdownReveal;
    prevCurrentTurn.current = game.currentTurnUserId;
    prevSeatActions.current = {};
    prevPot.current = game.pot;
    prevActionRequired.current = false;
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
    if (game.currentTurnUserId && game.currentTurnUserId !== prevCurrentTurn.current) {
      // F-19 port: compare the turn's seat number, not user id vs seat.
      const seatIdx = getSeatByUserId(game.currentTurnUserId);
      if (seatIdx !== undefined && seatIdx !== resolvedHeroSeat) {
        trigger('chipClink', { seatIndex: seatIdx });
      }
    }
    prevCurrentTurn.current = game.currentTurnUserId;
  }, [game.currentTurnUserId, resolvedHeroSeat, trigger, getSeatByUserId]);

  useEffect(() => {
    for (const [idx, seatRaw] of Object.entries(game.seats)) {
      const seat = seatRaw as Seat;
      const seatNum = Number(idx);
      const prevAction = prevSeatActions.current[seatNum];
      const currAction = seat.action?.text;
      if (currAction && currAction !== prevAction && seatNum !== resolvedHeroSeat) {
        const event = ACTION_TO_EVENT[currAction];
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
}
