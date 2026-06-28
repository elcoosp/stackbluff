import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getToken } from '@stackbluff/shared/auth/token';
import type { ClubWebSocketEvent, WebSocketConnectionStatus } from '../types/club';
import { logger } from '../lib/logger';

export function useClubWebSocket(clubId: string) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>('disconnected');

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = getToken();
    if (!token) {
      logger.warn('Cannot connect to WebSocket: no auth token');
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
    const ws = new WebSocket(`${wsUrl}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      logger.info('Club WebSocket connected', { clubId });
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      ws.send(JSON.stringify({ type: 'subscribe', channels: [`club:${clubId}`] }));
    };

    ws.onmessage = (event) => {
      try {
        const message: ClubWebSocketEvent = JSON.parse(event.data);

        if (message.clubId !== clubId) return;

        switch (message.type) {
          case 'club.updated':
            queryClient.invalidateQueries({ queryKey: ['club', clubId] });
            toast.info('Club settings updated');
            break;

          case 'tournament.created':
            queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
            toast.success('New tournament scheduled!');
            break;

          case 'tournament.registered':
            queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
            break;

          case 'leaderboard.refreshed':
            queryClient.invalidateQueries({ queryKey: ['club-leaderboard', clubId] });
            break;

          default:
            logger.warn('Unknown club event type', { type: message.type });
        }
      } catch (err) {
        logger.error('Failed to parse WebSocket message', err instanceof Error ? err : undefined);
      }
    };

    ws.onclose = () => {
      logger.info('Club WebSocket disconnected', { clubId });
      setConnectionStatus('reconnecting');

      if (reconnectAttemptsRef.current < 5) {
        const delay = 1000 * Math.pow(2, reconnectAttemptsRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          logger.info('Attempting to reconnect WebSocket', {
            attempt: reconnectAttemptsRef.current,
            clubId,
          });
          connect();
        }, delay);
      } else {
        logger.warn('Max WebSocket reconnect attempts reached', { clubId });
        setConnectionStatus('disconnected');
      }
    };

    ws.onerror = (err) => {
      logger.error('Club WebSocket error', err instanceof Error ? err : undefined, { clubId });
    };
  };

  useEffect(() => {
    connect();

    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [clubId]);

  return { connectionStatus };
}
