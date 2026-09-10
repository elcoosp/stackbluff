import { getToken } from '@stackbluff/shared/auth/token';

type MessageType =
  | 'club.updated'
  | 'tournament.created'
  | 'tournament.registered'
  | 'leaderboard.refreshed';

interface WebSocketMessage {
  type: MessageType;
  clubId: string;
  data?: Record<string, unknown>;
}

class ClubWebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const token = getToken();
    if (!token) {
      console.warn('Cannot connect to WebSocket: no auth token');
      return;
    }

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Club WebSocket connected');
        this.reconnectAttempts = 0;

        // Subscribe to club events
        this.ws?.send(
          JSON.stringify({
            type: 'subscribe',
            channels: ['club:*'],
          }),
        );
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Dispatch as custom DOM event (same pattern as game WebSocket)
          window.dispatchEvent(
            new CustomEvent('club:event', {
              detail: message,
            }),
          );
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('Club WebSocket disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('Club WebSocket error:', error);
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max WebSocket reconnect attempts reached');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
      );
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

// Singleton instance
export const clubWebSocket = new ClubWebSocketManager();
