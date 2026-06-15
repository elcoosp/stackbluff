import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { toast } from 'sonner';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

const parseMessage = (data: any) => {
  switch (data.type) {
    case 'TableState':
      return {
        type: 'TableState',
        seats: data.players?.map((player: any, idx: number) => ({
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
        min_raise: data.min_raise,
        max_raise: data.min_raise * 2,
        remaining_ms: data.remaining_ms,
      };
    case 'ActionBroadcast':
      return { type: 'ActionBroadcast', ...data };
    case 'HandResult':
      return {
        type: 'HandResult',
        winners: data.winners?.map((w: any) => ({ seat: 0, amount: w[1], cards: undefined })),
        pot: data.pot,
        community_cards: data.community_cards,
      };
    default:
      return null;
  }
};

export function useGameWebSocket(tableId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const gameStore = useGameStore();

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Build URL: same-origin (via Vite proxy) by default, or direct with token fallback
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
      ws.send(JSON.stringify({ type: 'join_table', table_id: tableId }));
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
        if (message.type === 'TableState') gameStore.setSnapshot(message);
        else if (message.type === 'ActionRequired') gameStore.setActionRequired(message);
        else if (message.type === 'ActionBroadcast') gameStore.applyActionBroadcast(message);
        else if (message.type === 'HandResult') gameStore.setHandResult(message);
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      wsRef.current = null;
      setConnectionStatus('reconnecting');
      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 3000);
    };

    ws.onerror = () => {
      // onclose fires immediately after onerror, nothing extra needed
    };
  }, [tableId, gameStore]);

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
        // ★ KEY FIX: Nullify onclose BEFORE closing to prevent the stale
        // callback from overriding state after the component unmounts.
        // This fixes the React StrictMode race condition.
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendAction = useCallback((action: string, amount?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'player_action', action, amount }));
      gameStore.clearActionRequired();
    }
  }, [gameStore]);

  return { sendAction, connectionStatus };
}
