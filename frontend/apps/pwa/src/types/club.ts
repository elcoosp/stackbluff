/**
 * Shared types for club management feature
 * Single source of truth for all club-related data structures
 */

export interface ClubDetails {
  id: string;
  name: string;
  logo_url: string | null;
  telegram_group_id: string | null;
  is_owner: boolean;
  members_count: number;
  pro_settings?: ClubProSettings;
}

export interface ClubProSettings {
  banner_url?: string;
  chip_preset?: string;
  felt_colour?: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  weekly_xp: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total_members: number;
  total_divisions: number;
  current_division: number;
}

export interface Tournament {
  id: string;
  name: string;
  scheduled_start: string;
  buy_in: number;
  max_players: number;
  current_registrations: number;
  status: 'Scheduled' | 'Registering' | 'Running' | 'Completed';
  is_registered: boolean;
  blind_schedule_id?: string;
}

export interface TournamentsResponse {
  tournaments: Tournament[];
}

export interface BlindTemplate {
  id: string;
  name: string;
  description?: string;
}

export interface ScheduleTournamentRequest {
  name: string;
  max_players: number;
  buy_in: number;
  scheduled_start: string;
  blind_schedule_id?: string;
}

export interface UpdateClubSettingsRequest {
  name?: string;
  logo_url?: string | null;
  telegram_group_id?: string | null;
  pro_settings?: ClubProSettings;
}

export interface ClubWebSocketEvent {
  type: 'club.updated' | 'tournament.created' | 'tournament.registered' | 'leaderboard.refreshed';
  clubId: string;
  data?: unknown;
}

export type WebSocketConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
