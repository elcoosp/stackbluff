export interface PlayerStats {
  user_id: string;
  display_name?: string;
  hands_played: number;
  hands_won: number;
  win_rate: number;
  vpip: number;
  pfr: number;
  aggression_factor: number;
  showdowns: number;
  showdown_wins: number;
  wtsd: number;
  total_wagered: number;
  total_won: number;
  net_profit: number;
  biggest_pot_won: number;
  all_in_count: number;
  last_hand_played_at?: string;
}
