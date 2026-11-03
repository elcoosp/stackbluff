import { useTournamentStore } from '@stackbluff/shared/src/stores/tournamentStore';
import type { TournamentSummary } from '@stackbluff/shared/src/types/tournament.types';
import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuthStore } from '../stores/authStore';
import { IconHistory } from './icons';
import { Screen } from './Screen';
import { EmptyState, ErrorState, Pill, ProgressBar, SkeletonList } from './ui';

/**
 * Tournaments tab — port of PWA routes/tournaments.tsx: type + status
 * filter tabs, tournament cards (register/unregister/spectate/play/results),
 * tournament-history link, buy-in confirm dialog.
 */

type TypeFilter = 'All' | 'SitAndGo' | 'Mtt';
type StatusFilter = 'All' | 'Registering' | 'Running' | 'Completed';

const REFRESH_INTERVAL_MS = 10_000;

export function TournamentsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const balance = useAuthStore((s) => s.balance);
  const registeredUsers = useTournamentStore((s) => s.registeredUsers);
  const setRegistered = useTournamentStore((s) => s.setRegistered);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [unregisteringId, setUnregisteringId] = useState<string | null>(null);
  const [buyInTournament, setBuyInTournament] = useState<TournamentSummary | null>(null);

  const typeParam = typeFilter !== 'All' ? typeFilter : undefined;
  const {
    data: allTournaments = [],
    isLoading,
    error,
    refetch,
  } = useQuery<TournamentSummary[]>({
    queryKey: ['tournaments', undefined, typeParam],
    queryFn: async () => {
      try {
        return (await api.tournaments(typeParam ? { type: typeParam } : undefined)) || [];
      } catch {
        return [];
      }
    },
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: REFRESH_INTERVAL_MS,
    retry: 2,
  });

  const filteredTournaments = allTournaments.filter((t) => {
    if (statusFilter === 'All') return true;
    return t.status === statusFilter;
  });

  const registerMutation = useMutation({
    mutationFn: ({ tournamentId, userId: uid }: { tournamentId: string; userId: string }) =>
      api.registerTournament(tournamentId, uid),
    onMutate: ({ tournamentId }) => setRegisteringId(tournamentId),
    onSuccess: (_data, { tournamentId }) => {
      toast.success('Registered successfully!');
      if (userId) setRegistered(tournamentId, userId, true);
      void queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setRegisteringId(null);
      setBuyInTournament(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Registration failed');
      setRegisteringId(null);
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: ({ tournamentId, userId: uid }: { tournamentId: string; userId: string }) =>
      api.unregisterTournament(tournamentId, uid),
    onMutate: ({ tournamentId }) => setUnregisteringId(tournamentId),
    onSuccess: (_data, { tournamentId }) => {
      toast.success('Unregistered successfully');
      if (userId) setRegistered(tournamentId, userId, false);
      void queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setUnregisteringId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Unregistration failed');
      setUnregisteringId(null);
    },
  });

  const handleRegister = (tournament: TournamentSummary) => {
    if (!userId) {
      toast.error('Please log in first');
      return;
    }
    if (registeredUsers[tournament.id]?.[userId]) {
      toast.info('You are already registered for this tournament');
      return;
    }
    setBuyInTournament(tournament);
  };

  const handlePlay = async (tournamentId: string) => {
    try {
      const data = await api.myTournamentTable(tournamentId);
      if (data.table_id) {
        router.push(`/table/${data.table_id}?tournamentId=${tournamentId}` as never);
      } else {
        toast.info('You are not seated yet. Wait for the tournament to start.');
      }
    } catch {
      toast.error('Failed to get table. Please try again.');
    }
  };

  const typeTabs: { key: TypeFilter; label: string }[] = [
    { key: 'All', label: 'All Types' },
    { key: 'SitAndGo', label: 'Sit & Go' },
    { key: 'Mtt', label: 'MTT' },
  ];
  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'All', label: 'All Status' },
    { key: 'Registering', label: 'Registering' },
    { key: 'Running', label: 'Running' },
    { key: 'Completed', label: 'Completed' },
  ];

  return (
    <Screen safeEdges={['top']}>
      <View style={styles.flex}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <AppText variant="display">Tournaments</AppText>
            <AppText variant="body" style={styles.subtitle}>
              Sit & Go and Multi-Table Tournaments. Register now and compete for the prize pool.
            </AppText>
          </View>
          <PressableScale onPress={() => router.push('/tournaments-history' as never)}>
            <Surface variant="card" radius={radii.base} style={styles.historyBtn}>
              <IconHistory size={14} color={colors.accent} />
              <Text style={styles.historyLabel}>HISTORY</Text>
            </Surface>
          </PressableScale>
        </View>

        <View style={styles.filters}>
          <View style={styles.filterGroup}>
            {typeTabs.map((tab) => (
              <FilterChip
                key={tab.key}
                label={tab.label}
                active={typeFilter === tab.key}
                onPress={() => setTypeFilter(tab.key)}
              />
            ))}
          </View>
          <View style={styles.filterGroup}>
            {statusTabs.map((tab) => (
              <FilterChip
                key={tab.key}
                label={tab.label}
                active={statusFilter === tab.key}
                onPress={() => setStatusFilter(tab.key)}
              />
            ))}
          </View>
        </View>

        {isLoading ? (
          <View style={styles.listPad}>
            <SkeletonList rows={4} height={96} />
          </View>
        ) : error ? (
          <ErrorState
            message="Failed to load tournaments. Retrying…"
            onRetry={() => void refetch()}
          />
        ) : filteredTournaments.length === 0 ? (
          <EmptyState title="No tournaments" message="No tournaments match the current filters." />
        ) : (
          <View style={styles.listPad}>
            {filteredTournaments.map((tournament) => {
              const isRegistered = userId ? !!registeredUsers[tournament.id]?.[userId] : false;
              return (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  isRegistered={isRegistered}
                  isRegistering={registeringId === tournament.id}
                  isUnregistering={unregisteringId === tournament.id}
                  onRegister={() => handleRegister(tournament)}
                  onUnregister={() => {
                    if (userId) {
                      unregisterMutation.mutate({ tournamentId: tournament.id, userId });
                    }
                  }}
                  onSpectate={() =>
                    router.push(
                      `/table/${tournament.id}?observe=true&tournamentId=${tournament.id}` as never,
                    )
                  }
                  onPlay={() => void handlePlay(tournament.id)}
                  onResults={() => router.push(`/tournaments/${tournament.id}` as never)}
                  onOpen={() => router.push(`/tournaments/${tournament.id}` as never)}
                />
              );
            })}
          </View>
        )}
      </View>

      <TournamentBuyInModal
        tournament={buyInTournament}
        balance={balance}
        isProcessing={registerMutation.isPending}
        onClose={() => setBuyInTournament(null)}
        onConfirm={() => {
          if (!buyInTournament || !userId) {
            toast.error('Your session has expired. Please log in again.');
            setBuyInTournament(null);
            return;
          }
          registerMutation.mutate({ tournamentId: buyInTournament.id, userId });
        }}
      />
    </Screen>
  );
}

/* ── Card ───────────────────────────────────────────────────────────────── */

function TournamentCard({
  tournament,
  isRegistered,
  isRegistering,
  isUnregistering,
  onRegister,
  onUnregister,
  onSpectate,
  onPlay,
  onResults,
  onOpen,
}: {
  tournament: TournamentSummary;
  isRegistered: boolean;
  isRegistering: boolean;
  isUnregistering: boolean;
  onRegister: () => void;
  onUnregister: () => void;
  onSpectate: () => void;
  onPlay: () => void;
  onResults: () => void;
  onOpen: () => void;
}) {
  const statusTone =
    tournament.status === 'Registering'
      ? 'accent'
      : tournament.status === 'Running'
        ? 'warning'
        : 'neutral';

  return (
    <Surface variant="card" radius={radii.base}>
      <Pressable onPress={onOpen}>
        <View style={styles.cardBody}>
          <View style={styles.cardHead}>
            <AppText variant="body" style={styles.cardTitle} numberOfLines={1}>
              {tournament.name || tournament.tournament_type}
            </AppText>
            <Pill label={tournament.status} tone={statusTone as 'accent' | 'warning' | 'neutral'} />
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>
              {tournament.tournament_type === 'SitAndGo' ? 'Sit & Go' : 'MTT'}
            </Text>
            <Text style={styles.metaText}>
              {tournament.registered}/{tournament.max_players} players
            </Text>
            <Text style={[styles.metaText, { color: colors.accent }]}>
              Prize ${tournament.prize_pool.toLocaleString()}
            </Text>
          </View>
          <ProgressBar
            percentage={
              tournament.max_players > 0
                ? (tournament.registered / tournament.max_players) * 100
                : 0
            }
          />
          <View style={styles.cardActions}>
            {tournament.status === 'Registering' && !isRegistered ? (
              <CardAction
                label={isRegistering ? '…' : 'Register'}
                accent
                loading={isRegistering}
                onPress={onRegister}
              />
            ) : null}
            {tournament.status === 'Registering' && isRegistered ? (
              <>
                <Pill label="Registered" tone="accent" />
                <CardAction
                  label={isUnregistering ? '…' : 'Unregister'}
                  loading={isUnregistering}
                  onPress={onUnregister}
                />
              </>
            ) : null}
            {tournament.status === 'Running' && isRegistered ? (
              <CardAction label="Play" accent onPress={onPlay} />
            ) : null}
            {tournament.status === 'Running' && !isRegistered ? (
              <CardAction label="Spectate" onPress={onSpectate} />
            ) : null}
            {tournament.status === 'Completed' ? (
              <CardAction label="Results" onPress={onResults} />
            ) : null}
          </View>
        </View>
      </Pressable>
    </Surface>
  );
}

function CardAction({
  label,
  onPress,
  accent,
  loading,
}: {
  label: string;
  onPress: () => void;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} disabled={loading}>
      <View style={[styles.cardAction, accent ? styles.cardActionAccent : null]}>
        <Text
          style={[
            styles.cardActionLabel,
            accent ? { color: colors.onAccent } : { color: colors.onBackground },
          ]}
        >
          {loading ? '…' : label.toUpperCase()}
        </Text>
      </View>
    </PressableScale>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress}>
      <View style={[styles.filterChip, active ? styles.filterChipActive : null]}>
        <Text style={[styles.filterChipLabel, active ? { color: colors.onBackground } : null]}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

/* ── Buy-in confirm dialog (TournamentBuyInDialog port) ─────────────────── */

function TournamentBuyInModal({
  tournament,
  balance,
  isProcessing,
  onClose,
  onConfirm,
}: {
  tournament: TournamentSummary | null;
  balance: number;
  isProcessing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!tournament) return null;
  const sufficient = balance >= tournament.buy_in;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalCard, { marginBottom: insets.bottom }]}>
          <Surface variant="elevated" radius={radii.lg} style={styles.modalInner}>
            <AppText variant="headline">Confirm Registration</AppText>
            <AppText variant="label" style={styles.modalSubtitle}>
              {tournament.name || tournament.tournament_type}
            </AppText>

            <View style={styles.kvBlock}>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Buy-in</Text>
                <Text style={styles.kvValue}>${tournament.buy_in.toLocaleString()}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Your balance</Text>
                <Text
                  style={[styles.kvValue, { color: sufficient ? colors.accent : colors.error }]}
                >
                  {balance.toLocaleString()}
                </Text>
              </View>
            </View>

            {!sufficient ? (
              <Text style={styles.warning}>Insufficient balance — visit the shop for chips.</Text>
            ) : null}

            <View style={styles.modalFooter}>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isProcessing || !sufficient}
                onPress={onConfirm}
                style={[styles.createBtn, (isProcessing || !sufficient) && styles.buttonDisabled]}
              >
                <Text style={styles.createLabel}>{isProcessing ? 'Registering…' : 'Confirm'}</Text>
              </Pressable>
            </View>
          </Surface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  subtitle: { color: colors.mutedForeground, marginTop: 2 },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.accent,
  },
  filters: { gap: 8 },
  filterGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.base,
    padding: 4,
    gap: 4,
  },
  filterChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radii.base - 4,
  },
  filterChipActive: { backgroundColor: colors.surfaceContainerHigh },
  filterChipLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  listPad: { gap: 12, paddingBottom: 8 },
  cardBody: { padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontWeight: '700', fontSize: 15 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaText: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  cardAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActionAccent: { backgroundColor: colors.accent, borderColor: colors.accent },
  cardActionLabel: { fontFamily: fonts.data, fontSize: 10, letterSpacing: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { width: '100%', maxWidth: 400 },
  modalInner: { padding: 20, gap: 12 },
  modalSubtitle: { textTransform: 'none', letterSpacing: 0 },
  kvBlock: { gap: 2 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between' },
  kvLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedForeground },
  kvValue: { fontFamily: fonts.data, fontSize: 13, color: colors.onBackground, fontWeight: '700' },
  warning: { color: colors.error, fontSize: 12 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.base },
  cancelLabel: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  createBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
  },
  createLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onAccent,
    textTransform: 'uppercase',
  },
  buttonDisabled: { opacity: 0.5 },
});
