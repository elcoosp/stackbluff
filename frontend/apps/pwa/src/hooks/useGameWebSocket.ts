import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { toast } from 'sonner';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

// --- Parse backend messages (RoomMessage) ---
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
      // data matches TableStateUpdate exactly
      const seats = data.players.map((p: any) => ({
        seat: p.seat,
        user_id: p.user_id,
        display_name: p.user_id, // placeholder; can be resolved later via user cache
        stack: p.stack,
        current_bet: p.current_bet,
        is_all_in: p.is_all_in,
        is_folded: p.is_folded,
        is_active: !p.is_folded && !p.is_all_in,
        avatar_url: undefined,
        position_badge: undefined,
      }));

      const communityCards = data.community_cards.map((c: any) => ({
        rank: c.rank,
        suit: c.suit,
      }));

      return {
        type: 'TableState',
        seats,
        communityCards,
        pot: data.pot,
        sidePots: data.side_pots || [],
        street: data.street,
        currentHandInProgress: data.current_hand_in_progress,
        currentTurnUserId: data.current_turn_user_id,
        tableId: data.table_id,
      };
    }

    case 'ActionRequired': {
      return {
        type: 'ActionRequired',
        playerId: data.player_id,
        timeoutSecs: data.timeout_secs,
        toCall: data.to_call,
        minRaise: data.min_raise,
        canCheck: data.can_check,
        pot: data.pot,
      };
    }

    case 'ActionBroadcast': {
      return {
        type: 'ActionBroadcast',
        playerId: data.player_id,
        action: data.action,
        amount: data.amount,
        newStack: data.new_stack,
        newPot: data.new_pot,
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
        const holeCards = (data.payload.hole_cards || []).map((c: any) => ({
          rank: c.rank,
          suit: c.suit,
        }));
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
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const reconnectAttempts = useRef(0);

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  // Store our own user ID and seat from Connected
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
      // Reset reconnect attempts on successful connection
      reconnectAttempts.current = 0;

      // Send join_table with buy_in (default 1000)
      ws.send(JSON.stringify({
        type: 'join_table',
        table_id: tableId,
        buy_in: 1000,   // TODO: make configurable
      }));

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
            // Ensure hero seat is set if we know it
            if (mySeatRef.current !== null) {
              const ourSeat = message.seats.find((s: any) => s.seat === mySeatRef.current);
              if (ourSeat && ourSeat.user_id === myUserIdRef.current) {
                // Hero is already identified, no extra action needed.
              }
            }
            setTableState(message);
            break;
          }
          case 'ActionRequired': {
            // Only if it's our turn
            if (myUserIdRef.current && message.playerId === myUserIdRef.current) {
              setActionRequired({
                toCall: message.toCall,
                minRaise: message.minRaise,
                canCheck: message.canCheck,
                pot: message.pot,
                timeoutSecs: message.timeoutSecs,
              });
            }
            break;
          }
          case 'ActionBroadcast': {
            applyActionBroadcast(message);
            break;
          }
          case 'HandResult': {
            setHandResult(message);
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

      // Exponential backoff: 3s, 4.5s, 6.75s, ... capped at 30s
      const delay = Math.min(3000 * Math.pow(1.5, reconnectAttempts.current), 30000);
      reconnectAttempts.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      // onclose fires immediately after onerror, nothing extra needed
    };
  }, [tableId]); // ✅ only tableId – store actions are stable

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
        wsRef.current.onclose = null; // prevent reconnect on manual close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendAction = useCallback((action: string, amount?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Map frontend action names to backend expected names
      const actionMap: Record<string, string> = {
        fold: 'fold',
        check: 'check',
        call: 'call',
        raise: 'raise',
        'all-in': 'allin',
        bet: 'bet',
      };
      const mapped = actionMap[action] || action;
      wsRef.current.send(JSON.stringify({
        type: 'player_action',
        action: mapped,
        amount: amount,
      }));
      clearActionRequired();
    }
  }, [clearActionRequired]);

  return { sendAction, connectionStatus };
}
