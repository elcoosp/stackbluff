import type {
  TournamentResultEntry,
  TournamentSummary,
} from '@stackbluff/shared/src/types/tournament.types';
import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useAuthGuard } from '../lib/authGuard';
import { Screen } from '../screens/Screen';
import { EmptyState, SkeletonList } from '../screens/ui';
import { useAuthStore } from '../stores/authStore';

/**
 * Tournament history — port of PWA routes/tournaments-history.tsx: completed
 * tournaments with the user's results (medals for top 3), sign-in gate.
 */

interface TournamentWithResults extends TournamentSummary {
  completed_at: string;
  results: TournamentResultEntry[];
}

export function TournamentsHistoryScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const userId = useAuthStore((s) => s.user?.id);

  const {
    data: tournaments,
    isLoading,
    error,
    refetch,
  } = useQuery<TournamentWithResults[]>({
    queryKey: ['tournament-history', userId],
    queryFn: async () => {
      const all = await api.tournaments({ status: 'Completed' });
      const withResults = await Promise.all(
        (all || []).map(async (t) => {
          const detail = await api.tournament(t.id);
          const resultsRes = await api.tournamentResults(t.id);
          const userResults = userId
            ? resultsRes.results.filter((r) => r.user_id === userId)
            : resultsRes.results;
          return {
            ...t,
            completed_at:
              (detail as { completed_at?: string }).completed_at || new Date().toISOString(),
            results: userResults || [],
          } as TournamentWithResults;
        }),
      );
      return userId ? withResults.filter((t) => t.results.length > 0) : withResults;
    },
    enabled: guarded && !!userId,
    staleTime: 60_000,
  });

  return (
    <Screen
      title="Tournament History"
      subtitle="Review your past performance, winnings, and final standings."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      {!guarded || !userId ? (
        <EmptyState
          title="Sign In Required"
          message="Please sign in to view your tournament history."
          action={
            <PressableScale onPress={() => router.replace('/(auth)/login' as never)}>
              <View style={styles.cta}>
                <Text style={styles.ctaLabel}>SIGN IN</Text>
              </View>
            </PressableScale>
          }
        />
      ) : isLoading ? (
        <SkeletonList rows={3} height={110} />
      ) : error ? (
        <EmptyState
          title="Failed to Load"
          message="There was an error loading your tournament history."
          action={
            <PressableScale onPress={() => void refetch()}>
              <View style={[styles.cta, { backgroundColor: colors.accent }]}>
                <Text style={[styles.ctaLabel, { color: colors.onAccent }]}>RETRY</Text>
              </View>
            </PressableScale>
          }
        />
      ) : !tournaments || tournaments.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          message="You haven't participated in any completed tournaments yet."
          action={
            <PressableScale onPress={() => router.replace('/(tabs)/tournaments' as never)}>
              <View style={[styles.cta, { backgroundColor: colors.accent }]}>
                <Text style={[styles.ctaLabel, { color: colors.onAccent }]}>
                  BROWSE TOURNAMENTS
                </Text>
              </View>
            </PressableScale>
          }
        />
      ) : (
        <View style={styles.list}>
          {tournaments.map((tournament) => (
            <Surface key={tournament.id} variant="card" radius={radii.base}>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <AppText variant="body" style={styles.cardTitle} numberOfLines={1}>
                    {tournament.name || tournament.tournament_type}
                  </AppText>
                  <Text style={styles.typePill}>
                    {tournament.tournament_type === 'SitAndGo' ? 'Sit & Go' : 'MTT'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    {new Date(tournament.completed_at).toLocaleDateString()}
                  </Text>
                  <Text style={styles.metaText}>{tournament.results.length} participants</Text>
                  <Text style={[styles.metaText, { color: '#facc15' }]}>
                    ${tournament.prize_pool.toLocaleString()} prize
                  </Text>
                </View>

                {tournament.results.length > 0 ? (
                  <View style={styles.resultsBlock}>
                    <AppText variant="label" style={styles.resultsLabel}>
                      YOUR RESULTS
                    </AppText>
                    {tournament.results.slice(0, 3).map((result) => (
                      <View key={result.user_id} style={styles.resultRow}>
                        <Text style={styles.resultMedal}>
                          {result.position <= 3
                            ? result.position === 1
                              ? '🥇'
                              : result.position === 2
                                ? '🥈'
                                : '🥉'
                            : `#${result.position}`}
                        </Text>
                        <Text style={styles.resultName} numberOfLines={1}>
                          {result.display_name || 'You'}
                        </Text>
                        <Text style={styles.resultPrize}>${result.prize.toLocaleString()}</Text>
                      </View>
                    ))}
                    {tournament.results.length > 3 ? (
                      <Text style={styles.moreNote}>+{tournament.results.length - 3} more…</Text>
                    ) : null}
                  </View>
                ) : null}

                <PressableScale
                  onPress={() => router.push(`/tournaments/${tournament.id}` as never)}
                >
                  <View style={styles.detailsBtn}>
                    <Text style={styles.detailsLabel}>VIEW DETAILS</Text>
                  </View>
                </PressableScale>
              </View>
            </Surface>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingBottom: 16 },
  card: { padding: 16, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontWeight: '700', fontSize: 15 },
  typePill: {
    fontFamily: fonts.data,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaText: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  resultsBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 6,
  },
  resultsLabel: { fontSize: 9 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.base,
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.border,
    borderWidth: 1,
  },
  resultMedal: { fontFamily: fonts.data, fontSize: 14, width: 28, textAlign: 'center' },
  resultName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.onBackground,
  },
  resultPrize: {
    fontFamily: fonts.data,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  moreNote: {
    fontFamily: fonts.data,
    fontSize: 10,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  detailsBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.onBackground,
  },
  cta: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.onBackground,
  },
});
