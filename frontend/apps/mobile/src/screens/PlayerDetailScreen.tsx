import type { PlayerStats } from '@stackbluff/shared/src/stores/gameStore';
import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api, type Badge } from '../lib/api';
import { Screen } from '../screens/Screen';
import { EmptyState, KeyValueRow, Pill, ProgressBar, SkeletonList, StatTile } from '../screens/ui';

/**
 * The stats endpoint returns a superset of the shared PlayerStats shape
 * (extra columns like last_hand_played_at / total_wagered). Declared here so
 * the screen can render them without widening the shared contract.
 */
type PlayerStatsDetail = PlayerStats & {
  last_hand_played_at?: string | null;
  total_wagered?: number;
};

/**
 * Player profile — port of PWA routes/players/$userId.tsx: stats summary,
 * preflop aggression + showdown detail, badges.
 */

export function PlayerDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : '';

  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery<PlayerStatsDetail>({
    queryKey: ['player-stats', userId],
    queryFn: () => api.playerStats(userId),
    enabled: !!userId,
    staleTime: 30_000,
    retry: 1,
  });

  const { data: badges } = useQuery<Badge[]>({
    queryKey: ['badges', userId],
    queryFn: () => api.userBadges(userId),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <Screen title="Player" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  if (error || !stats) {
    return (
      <Screen title="Player" onBack={() => router.back()} safeEdges={['top']}>
        <EmptyState
          title="Player unavailable"
          message="Could not load this player's stats."
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

  const winRate = stats.win_rate ?? 0;
  const vpip = stats.vpip ?? 0;
  const pfr = stats.pfr ?? 0;
  const showdowns = stats.showdowns ?? 0;
  const showdownWins = stats.showdown_wins ?? 0;

  return (
    <Screen
      title={stats.display_name || `Player ${userId.slice(0, 8)}`}
      subtitle={
        stats.last_hand_played_at
          ? `Last hand ${new Date(stats.last_hand_played_at).toLocaleDateString()}`
          : undefined
      }
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <View style={styles.flex}>
        <View style={styles.statRow}>
          <StatTile label="Hands" value={(stats.hands_played ?? 0).toLocaleString()} />
          <StatTile label="Win Rate" value={`${(winRate * 100).toFixed(1)}%`} />
          <StatTile
            label="Net Profit"
            value={`${(stats.net_profit ?? 0) >= 0 ? '+' : ''}${(stats.net_profit ?? 0).toLocaleString()}`}
            accent={(stats.net_profit ?? 0) >= 0}
          />
          <StatTile label="Biggest Pot" value={(stats.biggest_pot_won ?? 0).toLocaleString()} />
        </View>

        {badges && badges.length > 0 ? (
          <View style={styles.badgeWrap}>
            {badges.map((b) => (
              <Pill key={b.badge_type} label={b.badge_type.replace(/_/g, ' ')} tone="warning" />
            ))}
          </View>
        ) : null}

        <Surface variant="card" radius={radii.base} style={styles.detailCard}>
          <AppText variant="label">PREFLOP AGGRESSION</AppText>
          <StatBar label="VPIP" value={`${(vpip * 100).toFixed(1)}%`} percentage={vpip * 100} />
          <StatBar label="PFR" value={`${(pfr * 100).toFixed(1)}%`} percentage={pfr * 100} />
          <KeyValueRow
            label="Aggression Factor"
            value={(stats.aggression_factor ?? 0).toFixed(2)}
          />
        </Surface>

        <Surface variant="card" radius={radii.base} style={styles.detailCard}>
          <AppText variant="label">SHOWDOWNS</AppText>
          <StatBar
            label="Showdown Win Rate"
            value={showdowns > 0 ? `${((showdownWins / showdowns) * 100).toFixed(1)}%` : '0%'}
            percentage={showdowns > 0 ? (showdownWins / showdowns) * 100 : 0}
          />
          <KeyValueRow label="Total Showdowns" value={showdowns.toString()} />
          <KeyValueRow label="All-Ins" value={(stats.all_in_count ?? 0).toString()} />
          <KeyValueRow label="Total Wagered" value={(stats.total_wagered ?? 0).toLocaleString()} />
        </Surface>
      </View>
    </Screen>
  );
}

function StatBar({
  label,
  value,
  percentage,
}: {
  label: string;
  value: string;
  percentage: number;
}) {
  return (
    <View style={styles.statBar}>
      <View style={styles.statBarHead}>
        <Text style={styles.statBarLabel}>{label}</Text>
        <Text style={styles.statBarValue}>{value}</Text>
      </View>
      <ProgressBar percentage={percentage} height={5} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailCard: { padding: 16, gap: 8 },
  statBar: { gap: 4 },
  statBarHead: { flexDirection: 'row', justifyContent: 'space-between' },
  statBarLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedForeground },
  statBarValue: {
    fontFamily: fonts.data,
    fontSize: 13,
    fontWeight: '700',
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
