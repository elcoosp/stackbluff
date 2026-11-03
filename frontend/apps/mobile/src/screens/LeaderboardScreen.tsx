import { colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, type LeaderboardEntry } from '../lib/api';
import { useAuthGuard } from '../lib/authGuard';
import { IconCrown, IconMedal } from '../screens/icons';
import { Screen } from '../screens/Screen';
import { EmptyState, SegmentedTabs, SkeletonList, StatTile } from '../screens/ui';
import { useAuthStore } from '../stores/authStore';

/**
 * Leaderboard — port of PWA routes/leaderboard.tsx: podium (2nd/1st/3rd),
 * full rankings list, current-user rank highlight. Period tabs mirror the
 * PWA UI; the backend endpoint is the global list (same as the PWA hook).
 */

type Period = 'global' | 'weekly' | 'monthly';

export function LeaderboardScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const currentUser = useAuthStore((s) => s.user);
  const [period, setPeriod] = useState<Period>('global');

  const {
    data: entries,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', 'global'],
    queryFn: () => api.globalLeaderboard(),
    refetchInterval: 5 * 60_000,
    staleTime: 5 * 60_000,
    enabled: guarded,
  });

  if (!guarded) {
    return (
      <Screen title="Leaderboard" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={5} height={52} />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen title="Leaderboard" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={5} height={52} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Leaderboard" onBack={() => router.back()} safeEdges={['top']}>
        <EmptyState
          title="Failed to load"
          message={(error as Error).message}
          action={
            <PressableScale onPress={() => void refetch()}>
              <View style={styles.cta}>
                <Text style={styles.ctaLabel}>RETRY</Text>
              </View>
            </PressableScale>
          }
        />
      </Screen>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Screen title="Leaderboard" onBack={() => router.back()} safeEdges={['top']}>
        <EmptyState title="No data yet" message="No leaderboard data available yet." />
      </Screen>
    );
  }

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);
  const userRank = entries.findIndex((e) => e.user_id === currentUser?.id) + 1;
  const currentUserEntry = entries.find((e) => e.user_id === currentUser?.id);
  const podiumOrder = topThree.length === 3 ? [topThree[1], topThree[0], topThree[2]] : topThree;

  return (
    <Screen
      title="Leaderboard"
      subtitle="Compete globally and climb the ranks to earn exclusive rewards."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <View style={styles.flex}>
        <SegmentedTabs
          options={[
            { key: 'global', label: 'All Time' },
            { key: 'weekly', label: 'This Week' },
            { key: 'monthly', label: 'This Month' },
          ]}
          value={period}
          onChange={setPeriod}
        />

        {/* Podium: 2nd / 1st / 3rd */}
        <View style={styles.podiumRow}>
          {podiumOrder.map((entry) => {
            const isFirst = entry.rank === 1;
            return (
              <Surface
                key={entry.user_id}
                variant="card"
                radius={radii.base}
                style={[styles.podiumCard, isFirst ? styles.podiumFirst : null]}
              >
                {isFirst ? (
                  <IconCrown size={16} color="#facc15" />
                ) : (
                  <IconMedal size={14} color={colors.mutedForeground} />
                )}
                <Text style={styles.podiumName} numberOfLines={1}>
                  {entry.display_name}
                </Text>
                <Text style={[styles.podiumChips, isFirst ? { color: '#facc15' } : null]}>
                  {entry.total_chips_won.toLocaleString()}
                </Text>
                <Text style={styles.podiumRank}>#{entry.rank}</Text>
              </Surface>
            );
          })}
        </View>

        {userRank > 0 && currentUserEntry ? (
          <View style={styles.youRow}>
            <StatTile label="Your Rank" value={`#${userRank}`} accent />
            <StatTile
              label="Your Chips Won"
              value={currentUserEntry.total_chips_won.toLocaleString()}
            />
          </View>
        ) : null}

        <View style={styles.listBlock}>
          {rest.map((entry) => {
            const isYou = entry.user_id === currentUser?.id;
            return (
              <PressableScale
                key={entry.user_id}
                onPress={() => router.push(`/players/${entry.user_id}` as never)}
              >
                <Surface variant="card" radius={radii.base}>
                  <View style={[styles.row, isYou ? styles.rowYou : null]}>
                    <Text style={styles.rowRank}>#{entry.rank}</Text>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {entry.display_name}
                      {isYou ? ' (you)' : ''}
                    </Text>
                    <Text style={styles.rowChips}>{entry.total_chips_won.toLocaleString()}</Text>
                  </View>
                </Surface>
              </PressableScale>
            );
          })}
        </View>

        {isRefetching ? <Text style={styles.refreshNote}>Refreshing…</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  podiumCard: {
    flex: 1,
    padding: 12,
    gap: 4,
    alignItems: 'center',
    minHeight: 96,
    justifyContent: 'flex-end',
  },
  podiumFirst: { minHeight: 128, borderColor: 'rgba(250,204,21,0.4)' },
  podiumName: {
    fontFamily: fonts.data,
    fontSize: 11,
    color: colors.onBackground,
    maxWidth: '100%',
  },
  podiumChips: {
    fontFamily: fonts.data,
    fontSize: 12,
    fontWeight: '700',
    color: colors.onBackground,
  },
  podiumRank: { fontFamily: fonts.data, fontSize: 10, color: colors.mutedForeground },
  youRow: { flexDirection: 'row', gap: 10 },
  listBlock: { gap: 8, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  rowYou: { borderColor: `${colors.accent}55` },
  rowRank: { fontFamily: fonts.data, fontSize: 12, color: colors.mutedForeground, width: 32 },
  rowName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onBackground,
    fontWeight: '700',
  },
  rowChips: { fontFamily: fonts.data, fontSize: 12, color: colors.accent },
  refreshNote: {
    fontFamily: fonts.data,
    fontSize: 10,
    color: colors.mutedForeground,
    textAlign: 'center',
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
