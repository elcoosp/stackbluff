import { apiClient } from './api';

export async function createTournament(type: 'SitAndGo' | 'Mtt', maxPlayers: number, buyIn: number) {
  const payload = {
    tournament_type: type,
    max_players: maxPlayers,
    buy_in: buyIn,
    blind_schedule: {
      levels: [
        { level: 1, small_blind: 10, big_blind: 20, ante: 0, duration_seconds: 60 },
        { level: 2, small_blind: 20, big_blind: 40, ante: 0, duration_seconds: 60 },
      ],
    },
    payout_structure: {
      entries: [
        { position: 1, percentage: 70 },
        { position: 2, percentage: 30 },
      ],
    },
    start_delay_seconds: 15, // ← increased from 5 to give all players time to register
    min_players_to_start: maxPlayers,
  };
  const res = await apiClient<{ tournament_id: string }>('/tournaments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.tournament_id;
}
