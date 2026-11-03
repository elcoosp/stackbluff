import { useTournamentStore } from '@stackbluff/shared/src/stores/tournamentStore';
import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useAuthGuard } from '../lib/authGuard';
import { toast } from '../lib/toast';
import { IconArrowLeft, IconClock, IconTrophy, IconUsers } from '../screens/icons';
import { Screen } from '../screens/Screen';
import { Pill, ProgressBar, SkeletonList, StatTile } from '../screens/ui';
import { useAuthStore } from '../stores/authStore';

/**
 * Tournament detail — port of PWA routes/tournaments/$tournamentId.tsx:
 * info, register/unregister, progress stats, results when completed.
 * (The PWA's info/players tabs collapse here into info + results sections;
 * registrations drive the Registered state.)
 */

export function TournamentDetailScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const params = useLocalSearchParams<{ tournamentId?: string }>();
  const tournamentId = typeof params.tournamentId === 'string' ? params.tournamentId : '';
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const tournamentState = useTournamentStore((s) => s.tournamentStates[tournamentId]);

  const {
    data: tournament,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => api.tournament(tournamentId),
    enabled: guarded && !!tournamentId,
    staleTime: 30_000,
  });

  const { data: results } = useQuery({
    queryKey: ['tournament-results', tournamentId],
    queryFn: async () => {
      const res = await api.tournamentResults(tournamentId);
      return res.results || [];
    },
    enabled: !!tournamentId && tournament?.status === 'Completed',
    staleTime: 60_000,
  });

  const { data: registrations } = useQuery<{ user_id: string }[]>({
    queryKey: ['tournament-registrations', tournamentId],
    queryFn: () => api.tournamentRegistrations(tournamentId),
    enabled: !!tournamentId && !!userId,
    staleTime: 10_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['tournament-registrations', tournamentId] });
    void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
  };

  const registerMutation = useMutation({
    mutationFn: () => api.registerTournament(tournamentId, userId as string),
    onSuccess: () => {
      toast.success('Registered successfully!');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || 'Registration failed'),
  });

  const unregisterMutation = useMutation({
    mutationFn: () => api.unregisterTournament(tournamentId, userId as string),
    onSuccess: () => {
      toast.success('Unregistered successfully');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || 'Unregistration failed'),
  });

  if (!guarded) {
    return (
      <Screen title="Tournament" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen title="Tournament" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={4} height={90} />
      </Screen>
    );
  }

  if (error || !tournament) {
    return (
      <Screen title="Tournament" onBack={() => router.back()} safeEdges={['top']}>
        <View style={styles.centerWrap}>
          <AppText variant="headline" center>
            Tournament Not Found
          </AppText>
          <AppText variant="body" center style={styles.muted}>
            The tournament you're looking for doesn't exist or has been removed.
          </AppText>
          <ActionLink
            label="Back to Tournaments"
            onPress={() => router.replace('/(tabs)/tournaments' as never)}
          />
        </View>
      </Screen>
    );
  }

  const isRegistering = tournament.status === 'Registering';
  const isRunning = tournament.status === 'Running';
  const isCompleted = tournament.status === 'Completed';
  const isFull = tournament.registered >= tournament.max_players;
  const isRegistered = registrations?.some((r) => r.user_id === userId) || false;
  const canRegister = isRegistering && !isFull && !isRegistered && !!userId;
  const canUnregister = isRegistering && isRegistered && !!userId;
  const canSpectate = isRunning && !isRegistered;
  const canPlay = isRunning && isRegistered;
  const currentBlind = tournamentState?.blind_level ?? null;

  return (
    <Screen
      title={tournament.name || `${tournament.tournament_type} Tournament`}
      subtitle={`${tournament.tournament_type === 'SitAndGo' ? 'Sit & Go' : 'MTT'} · ${tournament.status}`}
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <View style={styles.flex}>
        <View style={styles.actionsRow}>
          {canRegister ? (
            <ActionLink
              label={registerMutation.isPending ? 'Registering…' : 'Register'}
              accent
              loading={registerMutation.isPending}
              onPress={() => registerMutation.mutate()}
            />
          ) : null}
          {canUnregister ? (
            <ActionLink
              label={unregisterMutation.isPending ? '…' : 'Unregister'}
              loading={unregisterMutation.isPending}
              onPress={() => unregisterMutation.mutate()}
            />
          ) : null}
          {canPlay ? (
            <ActionLink
              label="Play"
              accent
              onPress={() =>
                router.push(`/table/${tournamentId}?tournamentId=${tournamentId}` as never)
              }
            />
          ) : null}
          {canSpectate ? (
            <ActionLink
              label="Spectate"
              onPress={() =>
                router.push(
                  `/table/${tournamentId}?observe=true&tournamentId=${tournamentId}` as never,
                )
              }
            />
          ) : null}
          {isRegistered && isRegistering ? <Pill label="Registered" tone="accent" /> : null}
        </View>

        <View style={styles.statRow}>
          <StatTile
            label="Registered"
            value={`${tournament.registered}/${tournament.max_players}`}
          />
          <StatTile
            label="Prize Pool"
            value={`$${tournament.prize_pool.toLocaleString()}`}
            accent
          />
          <StatTile label="Buy-in" value={`$${tournament.buy_in.toLocaleString()}`} />
        </View>

        <Surface variant="card" radius={radii.base} style={styles.progressCard}>
          <View style={styles.progressHead}>
            <IconUsers size={13} color={colors.mutedForeground} />
            <AppText variant="label">REGISTRATIONS</AppText>
          </View>
          <ProgressBar
            percentage={
              tournament.max_players > 0
                ? (tournament.registered / tournament.max_players) * 100
                : 0
            }
          />
          <Text style={styles.progressNote}>
            {Math.max(0, tournament.max_players - tournament.registered)} spots left
          </Text>
        </Surface>

        <Surface variant="card" radius={radii.base} style={styles.progressCard}>
          <View style={styles.progressHead}>
            <IconClock size={13} color={colors.mutedForeground} />
            <AppText variant="label">STATUS</AppText>
          </View>
          <Text style={styles.statusText}>
            {isRegistering ? 'Registering' : isRunning ? 'Live' : 'Completed'}
          </Text>
          <Text style={styles.progressNote}>
            {tournament.started_at
              ? `Started ${new Date(tournament.started_at).toLocaleString()}`
              : 'Not started yet'}
          </Text>
          {currentBlind != null ? (
            <Text style={styles.progressNote}>Blind level: {currentBlind}</Text>
          ) : null}
        </Surface>

        {isCompleted && results && results.length > 0 ? (
          <Surface variant="card" radius={radii.base} style={styles.resultsCard}>
            <View style={styles.progressHead}>
              <IconTrophy size={13} color="#facc15" />
              <AppText variant="label">FINAL RESULTS</AppText>
            </View>
            {results.map((result) => (
              <View key={result.user_id} style={styles.resultRow}>
                <Text style={styles.resultRank}>#{result.position}</Text>
                <Text style={styles.resultName} numberOfLines={1}>
                  {result.display_name || result.user_id.slice(0, 8)}
                </Text>
                <Text style={styles.resultPrize}>${result.prize.toLocaleString()}</Text>
              </View>
            ))}
          </Surface>
        ) : null}

        <BackLink
          label="Back to Tournaments"
          onPress={() => router.replace('/(tabs)/tournaments' as never)}
        />
      </View>
    </Screen>
  );
}

function ActionLink({
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
      <View style={[styles.action, accent ? styles.actionAccent : null]}>
        <Text
          style={[
            styles.actionLabel,
            accent ? { color: colors.onAccent } : { color: colors.onBackground },
          ]}
        >
          {loading ? '…' : label.toUpperCase()}
        </Text>
      </View>
    </PressableScale>
  );
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress}>
      <View style={styles.backLink}>
        <IconArrowLeft size={13} color={colors.mutedForeground} />
        <Text style={styles.backLinkLabel}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  centerWrap: { gap: 10, alignItems: 'center', paddingVertical: 32 },
  muted: { color: colors.mutedForeground },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionAccent: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionLabel: { fontFamily: fonts.data, fontSize: 10, letterSpacing: 1 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  progressCard: { padding: 16, gap: 8 },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressNote: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  statusText: {
    fontFamily: fonts.data,
    fontSize: 16,
    fontWeight: '700',
    color: colors.onBackground,
  },
  resultsCard: { padding: 16, gap: 6 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.base,
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.border,
    borderWidth: 1,
  },
  resultRank: { fontFamily: fonts.data, fontSize: 12, color: colors.mutedForeground, width: 28 },
  resultName: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.onBackground },
  resultPrize: { fontFamily: fonts.data, fontSize: 12, fontWeight: '700', color: colors.accent },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  backLinkLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },
});
