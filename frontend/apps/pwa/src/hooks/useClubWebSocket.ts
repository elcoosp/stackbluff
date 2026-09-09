type WebSocketConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

import { getToken } from '@stackbluff/shared/auth/token';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { WEBSOCKET } from '../lib/constants';
import { logger } from '../lib/logger';
import type { ClubWebSocketEvent } from '../lib/schemas';
import { ClubWebSocketEventSchema } from '../lib/schemas';

function useWebSocketConnection(clubId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const [connectionStatus, setConnectionStatus] =
    useState<WebSocketConnectionStatus>('disconnected');

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = getToken();
    if (!token) {
      logger.warn('Cannot connect to WebSocket: no auth token');
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
    const ws = new WebSocket(`${wsUrl}/ws/club?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      logger.info('Club WebSocket connected', { clubId });
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      ws.send(JSON.stringify({ type: 'subscribe', channel: `club:${clubId}` }));
    };

    ws.onmessage = (event) => {
      try {
        const rawData = JSON.parse(event.data);
        const message = ClubWebSocketEventSchema.parse(rawData);

        window.dispatchEvent(new CustomEvent('club:event', { detail: message }));
      } catch (err) {
        logger.error('Failed to parse WebSocket message', err instanceof Error ? err : undefined);
      }
    };

    ws.onclose = () => {
      logger.info('Club WebSocket disconnected', { clubId });
      setConnectionStatus('reconnecting');

      if (reconnectAttemptsRef.current < WEBSOCKET.MAX_RECONNECT_ATTEMPTS) {
        const delay = WEBSOCKET.BASE_RECONNECT_DELAY * 2 ** reconnectAttemptsRef.current;
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
  }, [connect]);

  return { connectionStatus };
}

function useClubEventHandlers(clubId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ClubWebSocketEvent>;
      const message = customEvent.detail;

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
      }
    };

    window.addEventListener('club:event', handleEvent);
    return () => window.removeEventListener('club:event', handleEvent);
  }, [clubId, queryClient]);
}

export function useClubWebSocket(clubId: string) {
  const { connectionStatus } = useWebSocketConnection(clubId);
  useClubEventHandlers(clubId);

  return { connectionStatus };
}
