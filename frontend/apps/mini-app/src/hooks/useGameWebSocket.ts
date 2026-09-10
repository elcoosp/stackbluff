import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner'; // Added Sonner import

const getToken = () => {
  return localStorage.getItem('auth_token')!;
};

interface WebSocketMessage {
  type: string;
  players?: (string | number)[][];
  winners?: (string | number)[][];
  pot?: number;
  community_cards?: unknown[];
  to_call?: number;
  min_raise?: number;
  remaining_ms?: number;
  current_hand_in_progress?: boolean;
}

const parseMessage = (data: WebSocketMessage) => {
  switch (data.type) {
    case 'TableState':
      return {
        type: 'TableState',
        seats: (data.players ?? []).map((player: (string | number)[], idx: number) => ({
          seat_index: idx,
          user_id: player[0],
          stack: player[1],
          current_bet: player[2],
          is_all_in: player[3],
          is_active: true,
          display_name: `Player ${idx}`,
          avatar_url: undefined,
        })),
        community_cards: data.community_cards || [],
        pot: 0,
        side_pots: [],
        round: data.current_hand_in_progress ? 'preflop' : 'showdown',
        hero_seat: 0,
        hero_hole_cards: null,
      };
    case 'ActionRequired':
      return {
        type: 'ActionRequired',
        to_call: data.to_call,
        min_raise: data.min_raise ?? 0,
        max_raise: (data.min_raise ?? 0) * 2, // placeholder
        remaining_ms: data.remaining_ms,
      };
    case 'HandResult':
      return {
        type: 'HandResult',
        winners: (data.winners ?? []).map((w: (string | number)[]) => ({
          seat: 0,
          amount: Number(w[1]) || 0,
          cards: undefined,
        })),
        pot: data.pot,
        community_cards: data.community_cards,
      };
    default:
      console.warn('Unknown message type', data);
      return null;
  }
};

export function useGameWebSocket(tableId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'reconnecting' | 'disconnected'
  >('disconnected');
  const {
    setSnapshot,
    setActionRequired,
    applyActionBroadcast,
    setHandResult,
    clearActionRequired,
  } = useGameStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
    const token = getToken();
    const ws = new WebSocket(`${wsUrl}/ws/game?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      ws.send(JSON.stringify({ type: 'join_table', table_id: tableId }));
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

      // Optional: Let the user know they've reconnected successfully
      if (reconnectTimeoutRef.current) {
        toast.success('Reconnected', { description: 'Back at the table' });
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const message = parseMessage(data);
      if (!message) return;
      if (message.type === 'TableState') setSnapshot(message);
      else if (message.type === 'ActionRequired') setActionRequired(message);
      else if (message.type === 'ActionBroadcast') applyActionBroadcast(message);
      else if (message.type === 'HandResult') setHandResult(message);
    };

    ws.onclose = () => {
      setConnectionStatus('reconnecting');
      // Updated to use Sonner's API
      toast.info('Disconnected', { description: 'Attempting to reconnect in 3 seconds...' });
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
      toast.error('Connection Error', { description: 'Lost connection to the game server.' });
    };
  }, [tableId, setSnapshot, setActionRequired, applyActionBroadcast, setHandResult]);

  const sendAction = (action: string, amount?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'player_action', action, amount }));
      clearActionRequired();
    }
  };

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  return { sendAction, connectionStatus };
}
