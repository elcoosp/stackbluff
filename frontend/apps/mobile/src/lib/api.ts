import { apiClient } from '@stackbluff/shared/src/api/client';
import { tournamentApi } from '@stackbluff/shared/src/api/tournamentApi';
import type { PlayerStats } from '@stackbluff/shared/src/stores/gameStore';
import type {
  TournamentResult,
  TournamentSummary,
} from '@stackbluff/shared/src/types/tournament.types';
import { z } from 'zod';

/**
 * Thin REST helpers over the shared `apiClient` (Task 3-b).
 *
 * Endpoint paths mirror the PWA exactly (apps/pwa/src/lib/api.ts,
 * shopApi.ts, hooks/*, routes/*) — apiClient normalizes the `/api` prefix
 * and resolves the base URL from the configured platform surface, so the
 * same paths work on native with EXPO_PUBLIC_API_URL.
 *
 * NOTE: the shared `authApi` (packages/shared/src/auth/api.ts) fetches
 * `/api/...` relative to the page origin, which does not exist on native —
 * auth endpoints are re-declared here through apiClient so they hit the
 * configured backend origin.
 */

/* ── Shared response shapes (mirrors of the PWA types) ──────────────────── */

export interface AuthResponse {
  token: string;
  user: { id: string; username: string; email: string };
  balance?: number;
}

export interface Table {
  table_id: string;
  name: string;
  stake_level: string;
  current_players: number;
  max_players: number;
  status: string;
}

/** Lobby stake ladder (mirrors PWA lobby.tsx STAKE_CONFIG). */
export const STAKE_CONFIG: Record<string, { text: string; bb: number }> = {
  Micro: { text: '$0.02/$0.05', bb: 5 },
  Low: { text: '$0.10/$0.25', bb: 25 },
  Medium: { text: '$0.50/$1.00', bb: 100 },
  High: { text: '$2/$4', bb: 400 },
  VeryHigh: { text: '$5/$10', bb: 1000 },
};

export const stakeText = (stakeLevel: string): string =>
  STAKE_CONFIG[stakeLevel]?.text ?? stakeLevel;

export const stakeBB = (stakeLevel: string): number => STAKE_CONFIG[stakeLevel]?.bb ?? 0;

export interface Club {
  id: string;
  name: string;
  logo_url?: string | null;
  members_count: number;
  is_owner: boolean;
}

export interface ClubDetails extends Club {
  telegram_group_id?: string | null;
  is_member?: boolean;
  pro_settings?: {
    banner_url?: string;
    chip_preset?: string;
    felt_colour?: string;
  };
}

export interface ClubLeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  weekly_xp: number;
}

export interface ClubLeaderboardResponse {
  entries: ClubLeaderboardEntry[];
  total_members: number;
  total_divisions: number;
  current_division: number;
}

export interface ShopProduct {
  id: string;
  name: string;
  description: string;
  price_eur: number;
  price_stars: number;
  product_type: 'chips' | 'season_pass' | 'club_pro';
  chips_amount?: number;
  duration_days?: number;
}

const ShopProductsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    price_eur: z.number().nonnegative(),
    price_stars: z.number().int().nonnegative(),
    product_type: z.enum(['chips', 'season_pass', 'club_pro']),
    chips_amount: z.number().int().nonnegative().optional(),
    duration_days: z.number().int().nonnegative().optional(),
  }),
);

export interface Badge {
  badge_type: string;
  awarded_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  total_chips_won: number;
  rank: number;
  badges?: string[];
}

export interface Mission {
  id: number;
  mission_type: string;
  description: string;
  reward_chips: number;
  completed: boolean;
  progress: number;
  target: number;
  category: string;
}

export interface ReplayCard {
  id: string;
  hand_description: string;
  winner_name: string;
  winner_id: string;
  pot: number;
  played_at: string;
  table_id: string;
  community_cards?: string[];
  winner_cards?: string[];
  share_url: string;
}

export interface HandSummary {
  id: string;
  table_id: string;
  played_at: string;
  pot: number;
  winners: { user_id: string; amount: number; hand_rank: string }[];
  community_cards: string[];
  winner_hole_cards?: string[];
}

export interface HistoryResponse {
  histories: HandSummary[];
  total: number;
  next_cursor?: string;
}

export interface HandDetail {
  id: string;
  table_id: string;
  played_at: string;
  players: {
    player_id: string;
    user_id?: string;
    display_name?: string;
    seat: number;
    hole_cards?: string[];
    stack_before: number;
    stack_after: number;
    is_dealer: boolean;
  }[];
  actions: {
    player_id: string;
    action_type: string;
    amount?: number;
    timestamp_ms: number;
    street: string;
  }[];
  result: {
    winners: {
      player_id: string;
      hand_rank: number;
      hand_description: string;
      amount_won: number;
    }[];
    community_cards: string[];
    pot_distribution: { winner_id: string; amount: number }[];
  };
}

export interface PurchaseRecord {
  id: string;
  product_name: string;
  product_type: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'expired';
  created_at: string;
  completed_at?: string;
  payment_id: string;
  invoice_url?: string;
}

export interface ReferralStats {
  total_referred: number;
  bonus_earned: number;
  pending_bonus: number;
}

/** Server-synced notification preferences (PWA components/settings/
 * NotificationPreferences.tsx — GET/PATCH /notifications/preferences). */
export interface NotificationSettings {
  tournamentReminder60: boolean;
  tournamentReminder10: boolean;
  tournamentResults: boolean;
  clubAnnouncements: boolean;
  friendActivity: boolean;
  promotional: boolean;
}

export interface ReferralRecord {
  referred_id: string;
  display_name?: string;
  hand_count: number;
  bonus_awarded: boolean;
  created_at: string;
}

export interface PuzzleResponse {
  puzzle_id: number;
  hole_cards: string[];
  community_cards: string[];
  action_description: string;
  possible_actions: string[];
}

export interface PuzzleSubmitResponse {
  correct: boolean;
  explanation: string;
  user_action: string;
  correct_action: string;
}

export type { PlayerStats, TournamentResult, TournamentSummary };

/* ── API surface ────────────────────────────────────────────────────────── */

export const api = {
  /* Auth (paths mirror shared authApi, routed through apiClient) */
  login: (email: string, password: string) =>
    apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (username: string, email: string, password: string) =>
    apiClient<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),
  forgotPassword: (email: string) =>
    apiClient<{ status?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    apiClient<{ status?: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
  verifyEmail: (token: string) =>
    apiClient<{ status?: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: () =>
    apiClient<{ status?: string }>('/auth/resend-verification', { method: 'POST' }),
  me: () => apiClient<{ id: string; username: string; chip_balance: number }>('/auth/me'),

  /* Lobby / tables */
  tables: () => apiClient<Table[]>('/lobby'),
  createTable: (name: string, stakeLevel: string, maxPlayers: number) =>
    apiClient<{ table_id: string }>('/tables', {
      method: 'POST',
      body: JSON.stringify({ name, stake_level: stakeLevel, max_players: maxPlayers }),
    }),

  /* Tournaments (shared tournamentApi + registrations list) */
  tournaments: (params?: { type?: string; status?: string }) => tournamentApi.list(params),
  tournament: (id: string) => tournamentApi.get(id),
  tournamentResults: (id: string) => tournamentApi.results(id),
  registerTournament: (tournamentId: string, userId: string) =>
    tournamentApi.register(tournamentId, userId),
  unregisterTournament: (tournamentId: string, userId: string) =>
    tournamentApi.unregister(tournamentId, userId),
  myTournamentTable: (tournamentId: string) => tournamentApi.getMyTable(tournamentId),
  tournamentRegistrations: (tournamentId: string) =>
    apiClient<{ user_id: string }[]>(`/tournaments/${tournamentId}/registrations`),

  /* Clubs */
  clubs: () => apiClient<Club[]>('/clubs'),
  club: (clubId: string) => apiClient<ClubDetails>(`/clubs/${clubId}`),
  createClub: (name: string, telegramGroupId?: string) =>
    apiClient<{ club_id: string }>('/clubs', {
      method: 'POST',
      body: JSON.stringify(
        telegramGroupId ? { name, telegram_group_id: telegramGroupId } : { name },
      ),
    }),
  updateClub: (
    clubId: string,
    data: {
      name?: string;
      telegram_group_id?: string | null;
      pro_settings?: ClubDetails['pro_settings'];
    },
  ) =>
    apiClient<{ status?: string }>(`/clubs/${clubId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  clubInvitePreview: (code: string) => apiClient<ClubDetails>(`/clubs/invite/${code}`),
  joinClub: (inviteCode: string) =>
    apiClient<{ success: boolean }>('/clubs/join', {
      method: 'POST',
      body: JSON.stringify({ invite_code: inviteCode }),
    }),
  clubLeaderboard: (clubId: string, division: number) =>
    apiClient<ClubLeaderboardResponse>(`/clubs/${clubId}/leaderboard?division=${division}`),
  clubTournaments: (clubId: string) =>
    apiClient<Record<string, unknown>[]>(`/clubs/${clubId}/tournaments`),
  clubMembers: (clubId: string) =>
    apiClient<{ user_id: string; username?: string; display_name?: string; role?: string }[]>(
      `/clubs/${clubId}/members`,
    ),

  /* Shop (PWA lib/shopApi.ts paths) */
  shopProducts: async (): Promise<ShopProduct[]> => {
    const raw = await apiClient<unknown>('/shop/products');
    return ShopProductsSchema.parse(raw);
  },

  /* Leaderboard / missions / puzzle */
  globalLeaderboard: () => apiClient<LeaderboardEntry[]>('/leaderboard/global?offset=0'),
  missionsToday: () => apiClient<Mission[]>('/missions/today'),
  claimMissions: () =>
    apiClient<{ chips_awarded: number; streak_count: number; weekly_bonus_awarded: boolean }>(
      '/missions/claim',
      { method: 'POST' },
    ),
  rerollMission: (missionId: number) =>
    apiClient<Mission>('/missions/reroll', {
      method: 'POST',
      body: JSON.stringify({ mission_id: missionId }),
    }),
  puzzleToday: () => apiClient<PuzzleResponse>('/puzzle/today'),
  submitPuzzle: (selectedAction: string) =>
    apiClient<PuzzleSubmitResponse>('/puzzle/submit', {
      method: 'POST',
      body: JSON.stringify({ selected_action: selectedAction }),
    }),

  /* Players / profile */
  playerStats: (userId: string) => apiClient<PlayerStats>(`/players/${userId}/stats`),
  myBadges: async (): Promise<Badge[]> => {
    const data = await apiClient<{ badges: Badge[] }>('/users/me/badges');
    return data.badges;
  },
  userBadges: async (userId: string): Promise<Badge[]> => {
    const data = await apiClient<{ badges: Badge[] }>(`/users/${userId}/badges`);
    return data.badges;
  },
  updateProfile: (data: { display_name?: string; password?: string }) =>
    apiClient<{ status?: string }>('/user/me', { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: () =>
    apiClient<{ status: string }>('/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ password: '' }),
    }),
  exportData: () => apiClient<Record<string, unknown>>('/users/me/data', { method: 'GET' }),

  /* Hands / history / replays */
  handHistory: (limit: number, cursor?: string) =>
    apiClient<HistoryResponse>(`/hands?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  hand: (handId: string) => apiClient<HandDetail>(`/hands/${handId}`),
  replays: () => apiClient<ReplayCard[]>('/replays'),

  /* Payments */
  purchaseHistory: () => apiClient<PurchaseRecord[]>('/payments/history'),

  /* Referrals */
  referralStats: () => apiClient<ReferralStats>('/referrals/stats'),
  referralList: () => apiClient<ReferralRecord[]>('/referrals/list'),

  /* Notifications (preferences mirror the PWA settings component) */
  notificationPreferences: () =>
    apiClient<Partial<NotificationSettings>>('/notifications/preferences'),
  saveNotificationPreferences: (data: NotificationSettings) =>
    apiClient<NotificationSettings>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
