import { z } from 'zod';

export const TableSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  stake_level: z.string(),
  max_players: z.number().min(2).max(9),
  current_players: z.number().min(0),
  status: z.enum(['waiting', 'playing']),
});

export const LobbyResponseSchema = z.object({
  tables: z.array(TableSchema),
});

export const CreateTableResponseSchema = z.object({
  table_id: z.string(),
});

export type Table = z.infer<typeof TableSchema>;
export type LobbyResponse = z.infer<typeof LobbyResponseSchema>;
export type CreateTableResponse = z.infer<typeof CreateTableResponseSchema>;
