import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, type ClubDetails, type ClubLeaderboardResponse } from '../lib/api';
import { useAuthGuard } from '../lib/authGuard';
import { toast } from '../lib/toast';
import { IconCrown, IconRefresh, IconUsers } from '../screens/icons';
import { Screen } from '../screens/Screen';
import {
  EmptyState,
  ErrorState,
  Pill,
  SegmentedTabs,
  SkeletonList,
  TextField,
} from '../screens/ui';
import { useAuthStore } from '../stores/authStore';

/**
 * Club detail — port of PWA pages/ClubPage.tsx: header, leaderboard /
 * tournaments / settings(owner) tabs, member management for admins.
 */

type TabKey = 'leaderboard' | 'tournaments' | 'settings';

interface ClubMember {
  user_id: string;
  username?: string;
  display_name?: string;
  role?: string;
}

export function ClubDetailScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const params = useLocalSearchParams<{ clubId?: string }>();
  const clubId = typeof params.clubId === 'string' ? params.clubId : '';
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard');

  const {
    data: club,
    isLoading,
    error,
    refetch,
  } = useQuery<ClubDetails>({
    queryKey: ['club', clubId],
    queryFn: () => api.club(clubId),
    enabled: guarded && !!clubId,
    staleTime: 60_000,
  });

  if (!guarded) {
    return (
      <Screen title="Club" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen title="Club" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  if (error || !club) {
    return (
      <Screen title="Club" onBack={() => router.back()} safeEdges={['top']}>
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load club'}
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'tournaments', label: 'Tournaments' },
    ...(club.is_owner ? [{ key: 'settings' as const, label: 'Settings' }] : []),
  ];

  return (
    <Screen
      title={club.name}
      subtitle={`${club.members_count} members`}
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <View style={styles.flex}>
        {/* Header card */}
        <Surface variant="card" radius={radii.base} style={styles.headerCard}>
          <View style={styles.clubAvatar}>
            <Text style={styles.clubAvatarText}>{club.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerBody}>
            <View style={styles.badgeRow}>
              {club.is_owner ? (
                <View style={styles.ownerBadge}>
                  <IconCrown size={10} color={colors.accent} />
                  <Text style={styles.ownerBadgeLabel}>OWNER</Text>
                </View>
              ) : null}
              <Pill label={`${club.members_count} members`} tone="neutral" />
            </View>
            <Text style={styles.divisionNote}>
              {club.pro_settings?.felt_colour
                ? `Club felt: ${club.pro_settings.felt_colour}`
                : 'Standard club setup'}
            </Text>
          </View>
        </Surface>

        <SegmentedTabs options={tabs} value={activeTab} onChange={setActiveTab} />

        {activeTab === 'leaderboard' ? <ClubLeaderboardTab clubId={clubId} /> : null}
        {activeTab === 'tournaments' ? <ClubTournamentsTab clubId={clubId} /> : null}
        {activeTab === 'settings' && club.is_owner ? <ClubSettingsTab club={club} /> : null}
      </View>
    </Screen>
  );
}

/* ── Leaderboard tab (useClubLeaderboard port) ──────────────────────────── */

function ClubLeaderboardTab({ clubId }: { clubId: string }) {
  const [division, setDivision] = useState(1);

  const { data, isLoading, error, refetch, isRefetching } = useQuery<ClubLeaderboardResponse>({
    queryKey: ['club-leaderboard', clubId, division],
    queryFn: () => api.clubLeaderboard(clubId, division),
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 2,
    enabled: !!clubId,
  });

  if (isLoading) return <SkeletonList rows={5} height={52} />;
  if (error)
    return <ErrorState message="Failed to load leaderboard" onRetry={() => void refetch()} />;

  const entries = data?.entries ?? [];
  const divisions = data?.total_divisions ?? 1;

  return (
    <View style={styles.tabBlock}>
      {divisions > 1 ? (
        <View style={styles.divisionRow}>
          <PressableScale
            onPress={() => setDivision((d) => Math.max(1, d - 1))}
            disabled={division <= 1}
          >
            <Text style={[styles.divisionBtn, division <= 1 && styles.divisionBtnOff]}>‹ PREV</Text>
          </PressableScale>
          <Text style={styles.divisionLabel}>DIVISION {data?.current_division ?? division}</Text>
          <PressableScale
            onPress={() => setDivision((d) => Math.min(divisions, d + 1))}
            disabled={division >= divisions}
          >
            <Text style={[styles.divisionBtn, division >= divisions && styles.divisionBtnOff]}>
              NEXT ›
            </Text>
          </PressableScale>
        </View>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState title="No standings yet" message="Club leaderboard fills up as members play." />
      ) : (
        entries.map((entry) => (
          <Surface key={entry.user_id} variant="card" radius={radii.base}>
            <View style={styles.lbRow}>
              <Text style={styles.lbRank}>#{entry.rank}</Text>
              <View style={styles.lbBody}>
                <Text style={styles.lbName} numberOfLines={1}>
                  {entry.username}
                </Text>
              </View>
              <Text style={styles.lbXp}>{entry.weekly_xp.toLocaleString()} XP</Text>
            </View>
          </Surface>
        ))
      )}
      {isRefetching ? (
        <Text style={styles.refreshing}>Refreshing…</Text>
      ) : (
        <PressableScale onPress={() => void refetch()}>
          <View style={styles.refreshRow}>
            <IconRefresh size={12} color={colors.mutedForeground} />
            <Text style={styles.refreshLabel}>REFRESH</Text>
          </View>
        </PressableScale>
      )}
    </View>
  );
}

/* ── Tournaments tab (useClubTournaments port, simplified surface) ──────── */

interface ClubTournament {
  id: string;
  name?: string;
  status?: string;
  buy_in?: number;
  registered?: number;
  current_registrations?: number;
  max_players?: number;
}

function ClubTournamentsTab({ clubId }: { clubId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const { data, isLoading, error, refetch } = useQuery<ClubTournament[]>({
    queryKey: ['club-tournaments', clubId],
    queryFn: async () => {
      const raw = await api.clubTournaments(clubId);
      return raw as unknown as ClubTournament[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!clubId,
  });

  const registerMutation = useMutation({
    mutationFn: (tournamentId: string) => {
      if (!userId) return Promise.reject(new Error('Please log in first'));
      return api.registerTournament(tournamentId, userId);
    },
    onSuccess: () => {
      toast.success('Registered successfully!');
      void queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
    },
    onError: (err: Error) => toast.error(err.message || 'Registration failed'),
  });

  if (isLoading) return <SkeletonList rows={3} height={64} />;
  if (error)
    return <ErrorState message="Failed to load club tournaments" onRetry={() => void refetch()} />;

  const tournaments = data ?? [];
  if (tournaments.length === 0) {
    return (
      <EmptyState
        icon={<IconUsers size={22} color={colors.mutedForeground} />}
        title="No club tournaments"
        message="Club tournaments appear here once scheduled."
      />
    );
  }

  return (
    <View style={styles.tabBlock}>
      {tournaments.map((tournament) => (
        <Surface key={tournament.id} variant="card" radius={radii.base}>
          <View style={styles.ctRow}>
            <View style={styles.ctBody}>
              <Text style={styles.ctName} numberOfLines={1}>
                {tournament.name || tournament.id.slice(0, 8)}
              </Text>
              <Text style={styles.ctMeta}>
                {tournament.status ?? 'Scheduled'} ·{' '}
                {tournament.current_registrations ?? tournament.registered ?? 0}/
                {tournament.max_players ?? '—'} · buy-in ${tournament.buy_in ?? 0}
              </Text>
            </View>
            <PressableScale
              onPress={() => {
                if (!userId) {
                  toast.error('Please log in first');
                  return;
                }
                registerMutation.mutate(tournament.id);
              }}
            >
              <View style={styles.ctRegister}>
                <Text style={styles.ctRegisterLabel}>REGISTER</Text>
              </View>
            </PressableScale>
            <PressableScale onPress={() => router.push(`/tournaments/${tournament.id}` as never)}>
              <View style={styles.ctOpen}>
                <Text style={styles.ctOpenLabel}>OPEN</Text>
              </View>
            </PressableScale>
          </View>
        </Surface>
      ))}
    </View>
  );
}

/* ── Settings tab (owner): rename + felt colour + member management ─────── */

function ClubSettingsTab({ club }: { club: ClubDetails }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(club.name);
  const [feltColour, setFeltColour] = useState(club.pro_settings?.felt_colour ?? '#1a6b42');

  const { data: members } = useQuery<ClubMember[]>({
    queryKey: ['club-members', club.id],
    queryFn: () => api.clubMembers(club.id),
    staleTime: 60_000,
    enabled: !!club.id,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateClub(club.id, {
        name: name.trim() || club.name,
        pro_settings: { ...club.pro_settings, felt_colour: feltColour },
      }),
    onSuccess: () => {
      toast.success('Club settings saved');
      void queryClient.invalidateQueries({ queryKey: ['club', club.id] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save settings'),
  });

  return (
    <View style={styles.tabBlock}>
      <Surface variant="card" radius={radii.base} style={styles.settingsCard}>
        <AppText variant="label">CLUB NAME</AppText>
        <TextField value={name} onChangeText={setName} placeholder="Club name" />
        <AppText variant="label">ACCENT FELT (CLUB THEME)</AppText>
        <TextField value={feltColour} onChangeText={setFeltColour} placeholder="#1a6b42" />
        <PressableScale onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <View style={[styles.saveBtn, saveMutation.isPending && styles.buttonDisabled]}>
            <Text style={styles.saveLabel}>
              {saveMutation.isPending ? 'SAVING…' : 'SAVE SETTINGS'}
            </Text>
          </View>
        </PressableScale>
      </Surface>

      <AppText variant="label">MEMBERS</AppText>
      {!members ? (
        <SkeletonList rows={3} height={48} />
      ) : members.length === 0 ? (
        <Text style={styles.emptyMembers}>No member list available.</Text>
      ) : (
        members.map((member) => (
          <Surface key={member.user_id} variant="card" radius={radii.base}>
            <View style={styles.memberRow}>
              <View style={styles.memberBody}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {member.display_name || member.username || member.user_id.slice(0, 8)}
                </Text>
              </View>
              {member.role ? (
                <Pill label={member.role} tone={member.role === 'owner' ? 'accent' : 'neutral'} />
              ) : null}
            </View>
          </Surface>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  headerCard: { padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  clubAvatar: {
    width: 56,
    height: 56,
    borderRadius: radii.base,
    backgroundColor: colors.surfaceContainerHigh,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubAvatarText: {
    color: colors.onBackground,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
  headerBody: { flex: 1, minWidth: 0, gap: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: `${colors.accent}18`,
    borderColor: `${colors.accent}55`,
    borderWidth: 1,
  },
  ownerBadgeLabel: {
    fontFamily: fonts.data,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.accent,
  },
  divisionNote: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  tabBlock: { gap: 8, paddingBottom: 16 },
  divisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  divisionBtn: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  divisionBtnOff: { opacity: 0.35 },
  divisionLabel: {
    fontFamily: fonts.labelCaps,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mutedForeground,
  },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  lbRank: { fontFamily: fonts.data, fontSize: 12, color: colors.mutedForeground, width: 32 },
  lbBody: { flex: 1, minWidth: 0 },
  lbName: { fontFamily: fonts.body, fontSize: 14, color: colors.onBackground, fontWeight: '700' },
  lbXp: { fontFamily: fonts.data, fontSize: 12, color: colors.accent },
  refreshing: {
    fontFamily: fonts.data,
    fontSize: 10,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 6,
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  refreshLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mutedForeground,
  },
  ctRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  ctBody: { flex: 1, minWidth: 0, gap: 2 },
  ctName: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.onBackground },
  ctMeta: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  ctRegister: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
  },
  ctRegisterLabel: {
    fontFamily: fonts.data,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.onAccent,
  },
  ctOpen: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctOpenLabel: {
    fontFamily: fonts.data,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.onBackground,
  },
  settingsCard: { padding: 16, gap: 10 },
  saveBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
  },
  saveLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.onAccent,
  },
  buttonDisabled: { opacity: 0.5 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  memberBody: { flex: 1, minWidth: 0 },
  memberName: { fontFamily: fonts.body, fontSize: 13, color: colors.onBackground },
  emptyMembers: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
