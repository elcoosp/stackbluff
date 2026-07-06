import { z } from 'zod';

export const UserUpdatedPayloadSchema = z.object({
  type: z.literal('user.updated'),
  payload: z.object({
    balance: z.number().optional(),
    season_pass_expires_at: z.string().nullable().optional(),
    club_pro_expires_at: z.string().nullable().optional(),
    is_club_owner: z.boolean().optional(),
  }).optional(),
  data: z.object({
    balance: z.number().optional(),
    season_pass_expires_at: z.string().nullable().optional(),
    club_pro_expires_at: z.string().nullable().optional(),
    is_club_owner: z.boolean().optional(),
  }).optional(),
});

export type UserUpdatedMessage = z.infer<typeof UserUpdatedPayloadSchema>;
