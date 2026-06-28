/**
 * Shared types for club management feature
 * Types are inferred from Zod schemas in lib/schemas.ts
 * This file re-exports them for convenience
 */

export type {
  ClubDetails,
  ClubProSettings,
  LeaderboardEntry,
  LeaderboardResponse,
  Tournament,
  TournamentsResponse,
  BlindTemplate,
  ScheduleTournamentRequest,
  UpdateClubSettingsRequest,
  ClubWebSocketEvent,
} from '../lib/schemas';

export type WebSocketConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
