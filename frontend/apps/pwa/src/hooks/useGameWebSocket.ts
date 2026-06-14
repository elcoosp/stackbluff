import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { useToast } from '@/components/ui/use-toast';

// Helper to get auth token
const getToken = () => localStorage.getItem('auth_token') || 'demo-token';

// Helper to parse incoming WebSocket messages based on backend enum type
const parseMessage = (data: any) => {
  switch (data.type) {
    case 'TableState':
      // Transform backend TableStateUpdate to frontend TableState format
      return {
        type: 'TableState',
        seats: data.players.map((player: any, idx: number) => ({
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
        pot: 0, // not provided by backend, compute from players? For now set to 0
        side_pots: [],
        round: data.current_hand_in_progress ? 'preflop' : 'showdown',
        hero_seat: 0, // will be overridden when user joins
        hero_hole_cards: null,
      };
    case 'ActionRequired':
      return {
        type: 'ActionRequired',
        to_call: data.to_call,
        min_raise: data.min_raise,
        max_raise: data.max_raise, // backend doesn't send max_raise, we'll set to stack or pot
        remaining_ms: data.remaining_ms,
      };
    case 'HandResult':
      return {
        type: 'HandResult',
        winners: data.winners.map((w: any) => ({ seat: 0, amount: w[1], cards: undefined })),
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
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const { toast } = useToast();
  const { setSnapshot, setHeroHoleCards, setActionRequired, applyActionBroadcast, setHandResult, clearActionRequired } = useGameStore();

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
    const token = getToken();
    const ws = new WebSocket(`${wsUrl}/ws/game?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      ws.send(JSON.stringify({ type: 'join_table', table_id: tableId }));
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const message = parseMessage(data);
      if (!message) return;

      switch (message.type) {
        case 'TableState':
          setSnapshot(message);
          break;
        case 'ActionRequired':
          setActionRequired(message);
          break;
        case 'HandDealt':
          // Backend currently doesn't send HandDealt; we will infer from TableState hero_hole_cards later
          if (message.cards) setHeroHoleCards(message.cards);
          break;
        case 'ActionBroadcast':
          applyActionBroadcast(message);
          break;
        case 'HandResult':
          setHandResult(message);
          break;
      }
    };

    ws.onclose = () => {
      setConnectionStatus('reconnecting');
      toast({ title: 'Disconnected', description: 'Reconnecting...', variant: 'default' });
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => console.error('WebSocket error', err);
  };

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
  }, [tableId]);

  return { sendAction, connectionStatus };
}
