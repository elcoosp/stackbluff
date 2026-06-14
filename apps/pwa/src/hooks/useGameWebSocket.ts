import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { useUserStore } from '@stackbluff/shared/stores/userStore';
import { parseMessage, isTableState, isHandDealt, isActionRequired, isActionBroadcast, isHandResult } from 'sb-ws-messages';
import { useToast } from '@/components/ui/use-toast';
export function useGameWebSocket(tableId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const { toast } = useToast();
  const { setSnapshot, setHeroHoleCards, setActionRequired, applyActionBroadcast, setHandResult, clearActionRequired } = useGameStore();
  const token = useUserStore((state) => state.user?.id);
  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`wss://host/ws/game?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => { setConnectionStatus('connected'); ws.send(JSON.stringify({ type: 'join_table', table_id: tableId })); if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current); };
    ws.onmessage = (event) => { const data = JSON.parse(event.data); const message = parseMessage(data); if (isTableState(message)) setSnapshot(message); else if (isHandDealt(message)) setHeroHoleCards(message.cards); else if (isActionRequired(message)) setActionRequired(message); else if (isActionBroadcast(message)) applyActionBroadcast(message); else if (isHandResult(message)) setHandResult(message); else if (message.type === 'error') { console.error('WebSocket error', message); toast({ title: 'Game error', description: message.message, variant: 'destructive' }); } };
    ws.onclose = () => { setConnectionStatus('reconnecting'); toast({ title: 'Disconnected', description: 'Reconnecting...', variant: 'default' }); reconnectTimeoutRef.current = setTimeout(connect, 3000); };
    ws.onerror = (err) => console.error('WebSocket error', err);
  };
  const sendAction = (action: 'fold' | 'check' | 'call' | 'raise' | 'all-in', amount?: number) => { if (wsRef.current?.readyState === WebSocket.OPEN) { wsRef.current.send(JSON.stringify({ type: 'player_action', action, amount })); clearActionRequired(); } };
  useEffect(() => { connect(); return () => { wsRef.current?.close(); if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current); }; }, [tableId, token]);
  return { sendAction, connectionStatus };
}
