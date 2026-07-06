/**
 * Zod schemas for runtime type validation
 * Ensures API responses match expected shapes
 */

import { z } from 'zod';

// Club schemas
export const ClubProSettingsSchema = z.object({
  banner_url: z.string().url().optional(),
  chip_preset: z.string().optional(),
  felt_colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
});

export const ClubDetailsSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  logo_url: z.string().url().nullable(),
  telegram_group_id: z.string().nullable(),
  is_owner: z.boolean(),
  members_count: z.number().int().nonnegative(),
  pro_settings: ClubProSettingsSchema.optional(),
});

// Leaderboard schemas
export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  user_id: z.string().uuid(),
  username: z.string().min(1),
  avatar_url: z.string().url().nullable(),
  weekly_xp: z.number().int().nonnegative(),
});

export const LeaderboardResponseSchema = z.object({
  entries: z.array(LeaderboardEntrySchema),
  total_members: z.number().int().nonnegative(),
  total_divisions: z.number().int().positive(),
  current_division: z.number().int().positive(),
});

// Tournament schemas
export const TournamentStatusSchema = z.enum(['Scheduled', 'Registering', 'Running', 'Completed']);

export const TournamentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  scheduled_start: z.string().datetime(),
  buy_in: z.number().int().nonnegative(),
  max_players: z.number().int().min(10).max(500),
  current_registrations: z.number().int().nonnegative(),
  status: TournamentStatusSchema,
  is_registered: z.boolean(),
  blind_schedule_id: z.string().optional(),
});

export const TournamentsResponseSchema = z.object({
  tournaments: z.array(TournamentSchema),
});

export const BlindTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

export const ScheduleTournamentRequestSchema = z.object({
  name: z.string().min(1).max(200),
  max_players: z.number().int().min(10).max(500),
  buy_in: z.number().int().nonnegative(),
  scheduled_start: z.string().datetime(),
  blind_schedule_id: z.string().optional(),
});

export const UpdateClubSettingsRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  logo_url: z.string().url().nullable().optional(),
  telegram_group_id: z.string().nullable().optional(),
  pro_settings: ClubProSettingsSchema.optional(),
});

// WebSocket event schemas
export const ClubWebSocketEventSchema = z.object({
  type: z.enum(['club.updated', 'tournament.created', 'tournament.registered', 'leaderboard.refreshed']),
  clubId: z.string().uuid(),
  data: z.unknown().optional(),
});

// Export inferred types
export type ClubDetails = z.infer<typeof ClubDetailsSchema>;
export type ClubProSettings = z.infer<typeof ClubProSettingsSchema>;
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;
export type Tournament = z.infer<typeof TournamentSchema>;
export type TournamentsResponse = z.infer<typeof TournamentsResponseSchema>;
export type BlindTemplate = z.infer<typeof BlindTemplateSchema>;
export type ScheduleTournamentRequest = z.infer<typeof ScheduleTournamentRequestSchema>;
export type UpdateClubSettingsRequest = z.infer<typeof UpdateClubSettingsRequestSchema>;
export type ClubWebSocketEvent = z.infer<typeof ClubWebSocketEventSchema>;
