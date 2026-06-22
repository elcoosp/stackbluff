import { createContext, useContext, ReactNode, useRef, useState, useCallback, useEffect } from 'react';
import { useGameStore, TableState, ActionRequired } from '@stackbluff/shared/stores/gameStore';
import { toast } from 'sonner';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

// ── Rank & suit mapping ──
const rankDisplayMap: Record<string, string> = {
  Two: '2', Three: '3', Four: '4', Five: '5', Six: '6',
  Seven: '7', Eight: '8', Nine: '9', Ten: '10',
  Jack: 'J', Queen: 'Q', King: 'K', Ace: 'A',
};

const suitDisplayMap: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
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
        room_id: data.room_id,
        user_id: data.user_id,
        seat_index: data.seat_index,
      };
    }

    case 'RoomAssigned': {
      return {
        type: 'RoomAssigned',
        table_id: data.table_id,
        room_id: data.room_id,
      };
    }

    case 'TableState': {
      const seats = data.players.map((p: any) => ({
        seat: p.seat,
        user_id: p.user_id,
        display_name: p.display_name || 'Player',
        stack: p.stack,
        current_bet: p.current_bet,
        is_all_in: p.is_all_in,
        is_folded: p.is_folded,
        is_leaving: p.is_leaving || false,
        is_active: !p.is_folded && !p.is_all_in,
        avatar_url: p.avatar_url || undefined,
        position_badge: p.position_badge || undefined,
        action: p.last_action || undefined,
        stats: p.stats || undefined,
      }));
      const communityCards = (data.community_cards || []).map(convertCard);
      return {
        type: 'TableState',
        room_id: data.room_id,
        seats,
        community_cards: communityCards,
        pot: data.pot,
        side_pots: data.side_pots || [],
        street: data.street,
        current_hand_in_progress: data.current_hand_in_progress,
        current_turn_user_id: data.current_turn_user_id,
        current_turn_expires_at: data.current_turn_expires_at || null,
        current_turn_timeout_ms: data.current_turn_timeout_ms || null,
      };
    }
    case 'ActionRequired': {
      return {
        type: 'ActionRequired',
        room_id: data.room_id,
        player_id: data.player_id,
        expires_at: data.expires_at,
        timeout_ms: data.timeout_ms,
        to_call: data.to_call,
        min_raise: data.min_raise,
        can_check: data.can_check,
        pot: data.pot,
      };
    }

    case 'ActionBroadcast': {
      return {
        type: 'ActionBroadcast',
        room_id: data.room_id,
        player_id: data.player_id,
        action: data.action ? data.action.toUpperCase() : data.action,
        amount: data.amount ?? undefined,
        new_stack: data.new_stack,
        new_pot: data.new_pot,
      };
    }

    case 'ShowdownReveal': {
      const players = (data.players || []).map((p: any) => ({
        user_id: p.user_id,
        seat: p.seat,
        display_name: p.display_name || 'Player',
        hole_cards: (p.hole_cards || []).map(convertCard),
        hand_description: p.hand_description || '',
        is_winner: p.is_winner || false,
        win_amount: p.win_amount || 0,
        winning_cards: (p.winning_cards || []).map(convertCard),
      }));
      const communityCards = (data.community_cards || []).map(convertCard);
      return {
        type: 'ShowdownReveal',
        room_id: data.room_id,
        players,
        community_cards: communityCards,
        pot: data.pot || 0,
      };
    }

    case 'HandResult': {
      const winners = (data.winners || []).map((w: any) => {
        if (typeof w === 'string') {
          return { user_id: '', display_name: w, amount: 0, hand_rank: '' };
        }
        return {
          user_id: w.user_id || '',
          display_name: w.display_name || 'Player',
          amount: w.amount || 0,
          hand_rank: w.hand_rank || '',
        };
      });
      return {
        type: 'HandResult',
        room_id: data.room_id,
        winners,
        pot: data.pot || 0,
      };
    }

    case 'PrivateMessage': {
      if (data.payload?.type === 'your_hole_cards') {
        const holeCards = (data.payload.hole_cards || []).map(convertCard);
        return { type: 'YourHoleCards', room_id: data.room_id, holeCards };
      }
      if (data.payload?.type === 'analytics') {
        const analyticsData = data.payload.analytics;
        return {
          type: 'Analytics',
          room_id: data.room_id,
          analytics: {
            winProb: analyticsData.win_prob,
            potOdds: analyticsData.pot_odds,
            bestHand: analyticsData.best_hand,
            strength: analyticsData.strength,
          }
        };
      }
      return null;
    }

    default:
      console.warn('Unknown message type', data);
      return null;
  }
};

interface WSContextType {
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  myUserId: string | null;
  notSeated: boolean;
  sendJoin: (tableId: string, amount: number) => void;
  sendAction: (roomId: string, action: string, amount?: number) => void;
  sendRebuy: (roomId: string, amount: number) => void;
  sendLeave: (roomId: string) => void;
}

const WSContext = createContext<WSContextType | null>(null);

export function useWebSocket() {
  const ctx = useContext(WSContext);
  if (!ctx) throw new Error('useWebSocket must be used within WebSocketProvider');
  return ctx;
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);
  const reconnectAttempts = useRef(0);

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [notSeated, setNotSeated] = useState(false);

  const myUserIdRef = useRef<string | null>(null);
  const pendingJoins = useRef<Map<string, number>>(new Map()); // tableId -> amount

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    myUserIdRef.current = null;
    setNotSeated(false);

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const baseWs = import.meta.env.VITE_WS_URL || `${proto}://${window.location.host}`;
    const token = getToken();
    const url = token ? `${baseWs}/ws/game?token=${encodeURIComponent(token)}` : `${baseWs}/ws/game`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;

      ws.send(JSON.stringify({ type: 'reconnect' }));

      pendingJoins.current.forEach((amount, tableId) => {
        ws.send(JSON.stringify({ type: 'join_table', table_id: tableId, buy_in: amount }));
      });
      pendingJoins.current.clear();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
        toast.success('Reconnected', { description: 'Back at the table' });
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'Error') {
          if (data.message.includes("Not seated")) {
            setNotSeated(true);
            if (data.room_id) {
              useGameStore.getState().removeRoom(data.room_id);
            } else {
              useGameStore.setState({ rooms: {}, activeRoomId: null });
            }
            return;
          }
          toast.error(data.message || 'Game error');
          return;
        }

        const message = parseMessage(data);
        if (!message) return;

        setNotSeated(false);
        const roomId = message.room_id;
        const store = useGameStore.getState();

        switch (message.type) {
          case 'Connected': {
            if (myUserIdRef.current === null) {
              myUserIdRef.current = message.user_id;
              setMyUserId(message.user_id);
            }
            if (roomId) {
              store.ensureRoom(roomId);
              store.setHeroSeat(roomId, message.seat_index);
              // FIX: Always set active room on connect to prevent stale activeRoomId
              store.setActiveRoom(roomId);
            }
            break;
          }
          case 'RoomAssigned': {
            store.ensureRoom(message.room_id);
            // FIX: Store tableId in room state so TablePage can find it
            store.setRoomState(message.room_id, { tableId: message.table_id } as any);
            store.setActiveRoom(message.room_id);
            break;
          }
          case 'YourHoleCards': {
            if (roomId) store.setHeroHoleCards(roomId, message.holeCards);
            break;
          }
          case 'TableState': {
            if (roomId) {
              store.setRoomState(roomId, message as TableState);
              if (!store.activeRoomId) store.setActiveRoom(roomId);

              const state = message as TableState;
              if (!state.current_hand_in_progress || state.current_turn_user_id !== myUserIdRef.current) {
                store.clearActionRequired(roomId);
              }
            }
            break;
          }
          case 'ActionRequired': {
            if (roomId) {
              if (myUserIdRef.current && message.player_id === myUserIdRef.current) {
                store.setActionRequired(roomId, message as ActionRequired);
              } else {
                store.clearActionRequired(roomId);
              }
            }
            break;
          }
          case 'ActionBroadcast': {
            if (roomId) {
              store.applyActionBroadcast(roomId, {
                player_id: message.player_id,
                action: message.action,
                amount: message.amount,
                new_stack: message.new_stack,
                new_pot: message.new_pot,
              });
            }
            break;
          }
          case 'ShowdownReveal': {
            if (roomId) {
              store.setAnalytics(roomId, null);
              store.setShowdownReveal(roomId, {
                players: message.players,
                community_cards: message.community_cards,
                pot: message.pot,
              });
              store.clearActionRequired(roomId);
            }
            break;
          }
          case 'Analytics': {
            if (roomId) store.setAnalytics(roomId, message.analytics);
            break;
          }
          case 'HandResult': {
            if (roomId) {
              store.clearActionRequired(roomId);
              store.setAnalytics(roomId, null);
              store.setHandResult(roomId, { winners: message.winners, pot: message.pot });
            }
            break;
          }
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      wsRef.current = null;
      setConnectionStatus('reconnecting');
      const delay = Math.min(3000 * Math.pow(1.5, reconnectAttempts.current), 30000);
      reconnectAttempts.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => { };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendJoin = useCallback((tableId: string, amount: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'join_table', table_id: tableId, buy_in: amount }));
    } else {
      pendingJoins.current.set(tableId, amount);
      if (!wsRef.current) connect();
    }
  }, [connect]);

  const sendRebuy = useCallback((roomId: string, amount: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'rebuy', room_id: roomId, amount }));
    }
  }, []);

  const sendAction = useCallback((roomId: string, action: string, amount?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const actionMap: Record<string, string> = {
        fold: 'fold', check: 'check', call: 'call',
        raise: 'raise', 'all-in': 'allin', bet: 'bet',
      };
      const mapped = actionMap[action] || action;
      wsRef.current.send(JSON.stringify({ type: 'player_action', room_id: roomId, action: mapped, amount }));
    }
  }, []);

  const sendLeave = useCallback((roomId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_table', room_id: roomId }));

      const nextRoom = Object.keys(useGameStore.getState().rooms).find(id => id !== roomId);
      useGameStore.getState().setActiveRoom(nextRoom || null);
      useGameStore.getState().removeRoom(roomId);
    }
  }, []);

  return (
    <WSContext.Provider value={{ connectionStatus, myUserId, notSeated, sendJoin, sendAction, sendRebuy, sendLeave }}>
      {children}
    </WSContext.Provider>
  );
}
