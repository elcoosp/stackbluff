/**
 * Shared types for club management feature
 * Types are inferred from Zod schemas in lib/schemas.ts
 * This file re-exports them for convenience
 */

export type {
  BlindTemplate,
  ClubDetails,
  ClubProSettings,
  ClubWebSocketEvent,
  LeaderboardEntry,
  LeaderboardResponse,
  ScheduleTournamentRequest,
  Tournament,
  TournamentsResponse,
  UpdateClubSettingsRequest,
} from '../lib/schemas';

export type WebSocketConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
