import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export function useUserUpdates(socket: WebSocket | null) {
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'user.updated') {
          const payload = data.payload ?? data.data ?? {};
          const state = useAuthStore.getState();
          if (payload.balance !== undefined) state.setBalance(payload.balance);
          if (payload.season_pass_expires_at !== undefined) {
            state.setSeasonPassExpiresAt(payload.season_pass_expires_at);
          }
          if (payload.club_pro_expires_at !== undefined) {
            state.setClubProExpiresAt(payload.club_pro_expires_at);
          }
          if (payload.is_club_owner !== undefined) {
            state.setIsClubOwner(payload.is_club_owner);
          }
        }
      } catch {
        // Ignore non-JSON or malformed messages
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket]);
}
