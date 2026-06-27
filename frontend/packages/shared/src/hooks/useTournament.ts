import { useEffect } from 'react';
import { useTournamentStore } from '../stores/tournamentStore';

export function useTournament(tournamentId: string) {
  const tournament = useTournamentStore((s) => s.tournaments[tournamentId]);
  const state = useTournamentStore((s) => s.tournamentStates[tournamentId]);
  const setTournamentState = useTournamentStore((s) => s.setTournamentState);
  const setActiveTournament = useTournamentStore((s) => s.setActiveTournament);

  useEffect(() => {
    setActiveTournament(tournamentId);
    return () => {
      const currentActive = useTournamentStore.getState().activeTournamentId;
      if (currentActive === tournamentId) {
        setActiveTournament(null);
      }
    };
  }, [tournamentId, setActiveTournament]);

  return { tournament, state, setTournamentState };
}
