import type { PlayerStats } from '@stackbluff/shared/src/stores/gameStore';
import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api, type Badge } from '../lib/api';
import { useAuthGuard } from '../lib/authGuard';
import { toast } from '../lib/toast';
import {
  IconCoins,
  IconFilm,
  IconGem,
  IconHistory,
  IconLogOut,
  IconSettings,
  IconShare,
  IconSwords,
  IconTarget,
  IconUsers,
} from '../screens/icons';
import { Screen } from '../screens/Screen';
import { EmptyState, KeyValueRow, Pill, ProgressBar, SkeletonList, StatTile } from '../screens/ui';
import { useAuthStore } from '../stores/authStore';

/**
 * Profile tab — port of PWA routes/profile.tsx: header card (avatar initial,
 * balance), quick links, stats grid, aggression/showdown detail cards,
 * badges, logout.
 */

export function ProfileScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const user = useAuthStore((s) => s.user);
  const balance = useAuthStore((s) => s.balance);
  const logout = useAuthStore((s) => s.logout);
  const userId = user?.id;

  const { data: stats, isLoading: statsLoading } = useQuery<PlayerStats>({
    queryKey: ['player-stats', userId],
    queryFn: () => api.playerStats(userId as string),
    enabled: guarded && !!userId,
    staleTime: 30_000,
    retry: 1,
  });

  const { data: badges, isLoading: badgesLoading } = useQuery<Badge[]>({
    queryKey: ['badges'],
    queryFn: () => api.myBadges(),
    enabled: guarded,
    staleTime: 5 * 60_000,
  });

  if (!guarded) {
    return (
      <Screen safeEdges={['top']}>
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  const isLoading = statsLoading || badgesLoading;
  if (isLoading && !user) {
    return (
      <Screen safeEdges={['top']}>
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  const handsPlayed = stats?.hands_played ?? 0;
  const winRate = stats?.win_rate ?? 0;
  const vpip = stats?.vpip ?? 0;
  const pfr = stats?.pfr ?? 0;
  const aggressionFactor = stats?.aggression_factor ?? 0;
  const netProfit = stats?.net_profit ?? 0;
  const biggestPot = stats?.biggest_pot_won ?? 0;
  const allInCount = stats?.all_in_count ?? 0;
  const showdowns = stats?.showdowns ?? 0;
  const showdownWins = stats?.showdown_wins ?? 0;

  const quickLinks = [
    { to: '/history', icon: <IconHistory size={13} color={colors.accent} />, label: 'History' },
    { to: '/replays', icon: <IconFilm size={13} color={colors.accent} />, label: 'Replays' },
    { to: '/missions', icon: <IconTarget size={13} color={colors.accent} />, label: 'Missions' },
    { to: '/referrals', icon: <IconShare size={13} color={colors.accent} />, label: 'Referrals' },
    { to: '/(tabs)/clubs', icon: <IconUsers size={13} color={colors.accent} />, label: 'Clubs' },
    { to: '/settings', icon: <IconSettings size={13} color={colors.accent} />, label: 'Settings' },
  ];

  return (
    <Screen safeEdges={['top']}>
      <View style={styles.flex}>
        {/* Header card */}
        <Surface variant="card" radius={radii.base} style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.username || 'P').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerBody}>
              <AppText variant="headline" numberOfLines={1}>
                {user?.username || 'Player'}
              </AppText>
              <View style={styles.badgeRow}>
                {badges?.some((b) => b.badge_type === 'founding_member') ? (
                  <Pill label="Founding Member" tone="warning" />
                ) : null}
                <Pill label="Silver" tone="neutral" />
              </View>
            </View>
            <PressableScale onPress={() => router.push('/settings' as never)}>
              <Surface variant="card" radius={radii.base} style={styles.editBtn}>
                <IconSettings size={16} color={colors.accent} />
              </Surface>
            </PressableScale>
          </View>
          <View style={styles.balanceRow}>
            <IconCoins size={14} color={colors.accent} />
            <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
            <Text style={styles.balanceLabel}>chips</Text>
          </View>
        </Surface>

        {/* Quick links */}
        <View style={styles.quickLinks}>
          {quickLinks.map((link) => (
            <PressableScale key={link.to} onPress={() => router.push(link.to as never)}>
              <Surface variant="card" radius={radii.base} style={styles.quickLink}>
                {link.icon}
                <Text style={styles.quickLinkLabel}>{link.label}</Text>
              </Surface>
            </PressableScale>
          ))}
        </View>

        {/* Stats grid */}
        <View style={styles.statGrid}>
          <StatTile label="Hands Played" value={handsPlayed.toLocaleString()} />
          <StatTile label="Win Rate" value={`${(winRate * 100).toFixed(1)}%`} />
          <StatTile
            label="Net Profit"
            value={`${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString()}`}
            accent={netProfit >= 0}
          />
          <StatTile label="Biggest Pot" value={biggestPot.toLocaleString()} />
        </View>

        {/* Detail cards */}
        <View style={styles.detailGrid}>
          <Surface variant="card" radius={radii.base} style={styles.detailCard}>
            <View style={styles.detailHead}>
              <IconTarget size={13} color={colors.accent} />
              <AppText variant="label">PREFLOP AGGRESSION</AppText>
            </View>
            <StatBar label="VPIP" value={`${(vpip * 100).toFixed(1)}%`} percentage={vpip * 100} />
            <StatBar label="PFR" value={`${(pfr * 100).toFixed(1)}%`} percentage={pfr * 100} />
            <KeyValueRow label="Aggression Factor" value={aggressionFactor.toFixed(2)} />
          </Surface>

          <Surface variant="card" radius={radii.base} style={styles.detailCard}>
            <View style={styles.detailHead}>
              <IconSwords size={13} color={colors.accent} />
              <AppText variant="label">SHOWDOWNS</AppText>
            </View>
            <StatBar
              label="Showdown Win Rate"
              value={showdowns > 0 ? `${((showdownWins / showdowns) * 100).toFixed(1)}%` : '0%'}
              percentage={showdowns > 0 ? (showdownWins / showdowns) * 100 : 0}
            />
            <KeyValueRow label="Total Showdowns" value={showdowns.toString()} />
            <KeyValueRow label="All-Ins" value={allInCount.toString()} />
          </Surface>
        </View>

        {/* Badges */}
        <Surface variant="card" radius={radii.base} style={styles.badgesCard}>
          <View style={styles.detailHead}>
            <IconGem size={13} color={colors.accent} />
            <AppText variant="label">BADGES</AppText>
          </View>
          {badges && badges.length > 0 ? (
            <View style={styles.badgeWrap}>
              {badges.map((b) => (
                <Pill key={b.badge_type} label={b.badge_type.replace(/_/g, ' ')} tone="warning" />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyBadges}>No badges yet. Keep playing to earn them!</Text>
          )}
        </Surface>

        {!stats && !statsLoading ? (
          <EmptyState title="No stats yet" message="Play a few hands to build your profile." />
        ) : null}

        {/* Logout */}
        <PressableScale
          onPress={() => {
            logout();
            toast.info('Signed out');
            router.replace('/(auth)/login' as never);
          }}
        >
          <Surface variant="card" radius={radii.base} style={styles.logoutCard}>
            <IconLogOut size={15} color={colors.error} />
            <Text style={styles.logoutLabel}>LOGOUT</Text>
          </Surface>
        </PressableScale>
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
  headerCard: { padding: 16, gap: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceContainerHigh,
    borderColor: `${colors.accent}55`,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.onBackground,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
  headerBody: { flex: 1, minWidth: 0, gap: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  editBtn: { padding: 10 },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.base,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  balanceValue: {
    fontFamily: fonts.data,
    fontSize: 14,
    fontWeight: '700',
    color: colors.onBackground,
  },
  balanceLabel: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickLinkLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailGrid: { gap: 10 },
  detailCard: { padding: 16, gap: 8 },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  statBar: { gap: 4 },
  statBarHead: { flexDirection: 'row', justifyContent: 'space-between' },
  statBarLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedForeground },
  statBarValue: {
    fontFamily: fonts.data,
    fontSize: 13,
    fontWeight: '700',
    color: colors.onBackground,
  },
  badgesCard: { padding: 16, gap: 8 },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emptyBadges: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 8,
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderColor: `${colors.error}44`,
  },
  logoutLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.error,
  },
});
