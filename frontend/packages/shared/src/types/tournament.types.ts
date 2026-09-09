export type TournamentType = 'SitAndGo' | 'Mtt';
export type TournamentStatus = 'Registering' | 'Running' | 'Completed' | 'Cancelled';

export interface PayoutEntry {
  position: number;
  percentage: number;
}

export interface TournamentSummary {
  id: string;
  name: string;
  stake_level?: string;
  tournament_type: TournamentType;
  status: TournamentStatus;
  registered: number;
  max_players: number;
  min_players_to_start: number; // new
  starts_in_seconds?: number; // new
  buy_in: number;
  prize_pool: number;
  current_blind_level?: number;
  started_at?: Date;
  payout_structure?: PayoutEntry[];
  starts_at?: Date;
  blind_levels?: Array<{
    level: number;
    small_blind: number;
    big_blind: number;
    duration_secs: number;
  }>;
}

export interface TournamentState {
  tournament_id: string;
  status: string;
  registered_count: number;
  max_players: number;
  prize_pool: number;
  blind_level?: number;
  players_remaining?: number;
  tables?: Record<string, number>;
  my_table_id?: string;
  next_blind_at?: number;
}

export interface TournamentResultEntry {
  user_id: string;
  display_name?: string;
  position: number;
  prize: number;
}

export interface TournamentResult {
  tournament_id: string;
  results: TournamentResultEntry[];
}
