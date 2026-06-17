import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore, TableState, ActionRequired } from '@stackbluff/shared/stores/gameStore';
import { toast } from 'sonner';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

// ── Rank & suit mapping ──
const rankDisplayMap: Record<string, string> = {
  Two: '2',
  Three: '3',
  Four: '4',
  Five: '5',
  Six: '6',
  Seven: '7',
  Eight: '8',
  Nine: '9',
  Ten: '10',
  Jack: 'J',
  Queen: 'Q',
  King: 'K',
  Ace: 'A',
};

const suitDisplayMap: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

function convertCard(card: any) {
  if (!card) return { rank: '?', suit: '?' };
  return {
    rank: rankDisplayMap[card.rank] ?? card.rank,
    suit: suitDisplayMap[card.suit] ?? card.suit,
  };
}

// ── Parse backend messages ──
const parseMessage = (data: any) => {
  switch (data.type) {
    case 'Connected': {
      return {
        type: 'Connected',
        user_id: data.user_id,
        seat_index: data.seat_index,
      };
    }

    case 'TableState': {
      const seats = data.players.map((p: any) => ({
        seat: p.seat,
        user_id: p.user_id,
        display_name: p.user_id,
        stack: p.stack,
        current_bet: p.current_bet,
        is_all_in: p.is_all_in,
        is_folded: p.is_folded,
        is_active: !p.is_folded && !p.is_all_in,
        avatar_url: undefined,
        position_badge: undefined,
      }));
      const communityCards = (data.community_cards || []).map(convertCard);
      return {
        type: 'TableState',
        table_id: data.table_id,
        seats,
        community_cards: communityCards,
        pot: data.pot,
        side_pots: data.side_pots || [],
        street: data.street,
        current_hand_in_progress: data.current_hand_in_progress,
        current_turn_user_id: data.current_turn_user_id,
        dealer_index: data.dealer_index,
      };
    }

    case 'ActionRequired': {
      return {
        type: 'ActionRequired',
        player_id: data.player_id,
        timeout_secs: data.timeout_secs,
        to_call: data.to_call,
        min_raise: data.min_raise,
        can_check: data.can_check,
        pot: data.pot,
      };
    }

    case 'ActionBroadcast': {
      return {
        type: 'ActionBroadcast',
        player_id: data.player_id,
        action: data.action,
        amount: data.amount,
        new_stack: data.new_stack,
        new_pot: data.new_pot,
      };
    }

    case 'HandResult': {
      return {
        type: 'HandResult',
        winners: data.winners || [],
        pot: data.pot || 0,
      };
    }

    case 'PrivateMessage': {
      if (data.payload?.type === 'your_hole_cards') {
        const holeCards = (data.payload.hole_cards || []).map(convertCard);
        return {
          type: 'YourHoleCards',
          holeCards,
        };
      }
      return null;
    }

    case 'Error': {
      toast.error(data.message || 'Game error');
      return null;
    }

    default:
      console.warn('Unknown message type', data);
      return null;
  }
};

export function useGameWebSocket(tableId: string) {
  // ── Stable store action selectors ──
  const setHeroSeat = useGameStore((s) => s.setHeroSeat);
  const setHeroHoleCards = useGameStore((s) => s.setHeroHoleCards);
  const setTableState = useGameStore((s) => s.setTableState);
  const setActionRequired = useGameStore((s) => s.setActionRequired);
  const applyActionBroadcast = useGameStore((s) => s.applyActionBroadcast);
  const setHandResult = useGameStore((s) => s.setHandResult);
  const clearActionRequired = useGameStore((s) => s.clearActionRequired);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);
  const reconnectAttempts = useRef(0);

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  const myUserIdRef = useRef<string | null>(null);
  const mySeatRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const baseWs = import.meta.env.VITE_WS_URL || `${proto}://${window.location.host}`;
    const token = getToken();
    const url = token
      ? `${baseWs}/ws/game?token=${encodeURIComponent(token)}`
      : `${baseWs}/ws/game`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
      ws.send(
        JSON.stringify({
          type: 'join_table',
          table_id: tableId,
          buy_in: 1000,
        })
      );
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
        toast.success('Reconnected', { description: 'Back at the table' });
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const message = parseMessage(data);
        if (!message) return;

        switch (message.type) {
          case 'Connected': {
            myUserIdRef.current = message.user_id;
            mySeatRef.current = message.seat_index;
            setHeroSeat(message.seat_index);
            break;
          }
          case 'YourHoleCards': {
            setHeroHoleCards(message.holeCards);
            break;
          }
          case 'TableState': {
            setTableState(message as TableState);
            break;
          }
          case 'ActionRequired': {
            if (myUserIdRef.current && message.player_id === myUserIdRef.current) {
              setActionRequired(message as ActionRequired);
            }
            break;
          }
          case 'ActionBroadcast': {
            applyActionBroadcast({
              player_id: message.player_id,
              action: message.action,
              amount: message.amount,
              new_stack: message.new_stack,
              new_pot: message.new_pot,
            });
            break;
          }
          case 'HandResult': {
            setHandResult({
              winners: message.winners,
              pot: message.pot,
            });
            break;
          }
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = (event) => {
      console.warn(
        `WebSocket closed: code=${event.code}, reason=${event.reason || 'no reason'}, wasClean=${event.wasClean}`
      );
      if (!mountedRef.current) return;
      wsRef.current = null;
      setConnectionStatus('reconnecting');
      const delay = Math.min(3000 * Math.pow(1.5, reconnectAttempts.current), 30000);
      reconnectAttempts.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      // onclose fires immediately after onerror
    };
  }, [tableId]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendAction = useCallback(
    (action: string, amount?: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const actionMap: Record<string, string> = {
          fold: 'fold',
          check: 'check',
          call: 'call',
          raise: 'raise',
          'all-in': 'allin',
          bet: 'bet',
        };
        const mapped = actionMap[action] || action;
        wsRef.current.send(
          JSON.stringify({
            type: 'player_action',
            action: mapped,
            amount: amount,
          })
        );
        clearActionRequired();
      }
    },
    [clearActionRequired]
  );

  return { sendAction, connectionStatus };
}
