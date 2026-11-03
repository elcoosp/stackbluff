import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api, type ReferralRecord, type ReferralStats } from '../lib/api';
import { useAuthGuard } from '../lib/authGuard';
import { toast } from '../lib/toast';
import { Screen } from '../screens/Screen';
import { EmptyState, SkeletonList, StatTile } from '../screens/ui';
import { useAuthStore } from '../stores/authStore';

/**
 * Referrals — port of PWA routes/referrals.tsx: stats tiles, referral link
 * (toast copy — expo-clipboard not in the dep set), referred players list.
 */

export function ReferralsScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const user = useAuthStore((s) => s.user);

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<ReferralStats>({
    queryKey: ['referrals', 'stats'],
    queryFn: () => api.referralStats(),
    enabled: guarded,
    staleTime: 60_000,
  });

  const { data: referrals, isLoading: referralsLoading } = useQuery<ReferralRecord[]>({
    queryKey: ['referrals', 'list'],
    queryFn: () => api.referralList(),
    enabled: guarded,
    staleTime: 60_000,
  });

  if (!guarded) {
    return (
      <Screen title="Referrals" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  const referralLink = user?.id ? `https://stackbluff.com/register?ref=${user.id}` : '';

  return (
    <Screen
      title="Referrals"
      subtitle="Invite players and earn chips when they hit the tables."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <View style={styles.flex}>
        {statsLoading ? (
          <SkeletonList rows={1} height={80} />
        ) : statsError || !stats ? (
          <EmptyState title="Failed to load" message="Referral stats unavailable." />
        ) : (
          <View style={styles.statRow}>
            <StatTile label="Referred" value={stats.total_referred.toString()} />
            <StatTile label="Bonus Earned" value={stats.bonus_earned.toLocaleString()} accent />
            <StatTile label="Pending" value={stats.pending_bonus.toLocaleString()} />
          </View>
        )}

        <Surface variant="card" radius={radii.base} style={styles.linkCard}>
          <AppText variant="label">YOUR REFERRAL LINK</AppText>
          <Text style={styles.linkText} numberOfLines={1}>
            {referralLink || 'Sign in to get your link'}
          </Text>
          <PressableScale
            onPress={() => {
              if (referralLink) toast.info(`Referral link: ${referralLink}`);
            }}
          >
            <View style={styles.copyBtn}>
              <Text style={styles.copyLabel}>SHARE LINK</Text>
            </View>
          </PressableScale>
        </Surface>

        <AppText variant="label">REFERRED PLAYERS</AppText>
        {referralsLoading ? (
          <SkeletonList rows={3} height={56} />
        ) : !referrals || referrals.length === 0 ? (
          <EmptyState
            title="No referrals yet"
            message="Share your link to start earning referral bonuses."
          />
        ) : (
          <View style={styles.listBlock}>
            {referrals.map((referral) => (
              <Surface key={referral.referred_id} variant="card" radius={radii.base}>
                <View style={styles.row}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {referral.display_name || referral.referred_id.slice(0, 8)}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {referral.hand_count} hands ·{' '}
                      {new Date(referral.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.rowBonus,
                      { color: referral.bonus_awarded ? colors.accent : colors.mutedForeground },
                    ]}
                  >
                    {referral.bonus_awarded ? 'Bonus awarded' : 'Pending'}
                  </Text>
                </View>
              </Surface>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  linkCard: { padding: 16, gap: 8 },
  linkText: {
    fontFamily: fonts.data,
    fontSize: 12,
    color: colors.onBackground,
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.base - 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  copyBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
  },
  copyLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.onAccent,
  },
  listBlock: { gap: 8, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.onBackground,
  },
  rowMeta: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  rowBonus: { fontFamily: fonts.data, fontSize: 11 },
});
