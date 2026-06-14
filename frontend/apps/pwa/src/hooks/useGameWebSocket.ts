import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { useToast } from '@/components/ui/use-toast';

export function useGameWebSocket(tableId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const { toast } = useToast();
  const { setSnapshot, setHeroHoleCards, setActionRequired, applyActionBroadcast, setHandResult, clearActionRequired } = useGameStore();
  const token = localStorage.getItem('token') || 'demo-token';

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`wss://host/ws/game?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => { setConnectionStatus('connected'); ws.send(JSON.stringify({ type: 'join_table', table_id: tableId })); if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current); };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'TableState') setSnapshot(data);
      else if (data.type === 'HandDealt') setHeroHoleCards(data.cards);
      else if (data.type === 'ActionRequired') setActionRequired(data);
      else if (data.type === 'ActionBroadcast') applyActionBroadcast(data);
      else if (data.type === 'HandResult') setHandResult(data);
      else if (data.type === 'error') toast({ title: 'Game error', description: data.message, variant: 'destructive' });
    };
    ws.onclose = () => { setConnectionStatus('reconnecting'); toast({ title: 'Disconnected', description: 'Reconnecting...', variant: 'default' }); reconnectTimeoutRef.current = setTimeout(connect, 3000); };
    ws.onerror = (err) => console.error('WebSocket error', err);
  };
  const sendAction = (action: string, amount?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'player_action', action, amount }));
      clearActionRequired();
    }
  };
  useEffect(() => { connect(); return () => { wsRef.current?.close(); if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current); }; }, [tableId]);
  return { sendAction, connectionStatus };
}
