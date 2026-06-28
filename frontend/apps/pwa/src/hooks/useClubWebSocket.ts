import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ClubWebSocketEvent {
  type: 'club.updated' | 'tournament.created' | 'tournament.registered' | 'leaderboard.refreshed';
  clubId: string;
  data?: any;
}

/**
 * Hook to listen for club-specific WebSocket events
 * Follows the same pattern as useGameWebSocket (custom DOM events)
 */
export function useClubWebSocket(clubId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleClubEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ClubWebSocketEvent>;
      const { type, clubId: eventClubId, data } = customEvent.detail;

      // Only handle events for this club
      if (eventClubId !== clubId) return;

      switch (type) {
        case 'club.updated':
          // Invalidate club details
          queryClient.invalidateQueries({ queryKey: ['club', clubId] });
          toast.info('Club settings updated');
          break;

        case 'tournament.created':
          // Invalidate tournaments list
          queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
          toast.success('New tournament scheduled!');
          break;

        case 'tournament.registered':
          // Invalidate tournaments list to update registration counts
          queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
          break;

        case 'leaderboard.refreshed':
          // Invalidate leaderboard
          queryClient.invalidateQueries({ queryKey: ['club-leaderboard', clubId] });
          break;

        default:
          console.warn('Unknown club event type:', type);
      }
    };

    // Listen for club events
    window.addEventListener('club:event', handleClubEvent);

    return () => {
      window.removeEventListener('club:event', handleClubEvent);
    };
  }, [clubId, queryClient]);
}

/**
 * Dispatch a club event (for testing or manual triggering)
 */
export function dispatchClubEvent(event: ClubWebSocketEvent): void {
  window.dispatchEvent(new CustomEvent('club:event', { detail: event }));
}
