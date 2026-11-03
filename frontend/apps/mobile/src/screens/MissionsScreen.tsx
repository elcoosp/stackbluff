import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api, type Mission } from '../lib/api';
import { useAuthGuard } from '../lib/authGuard';
import { toast } from '../lib/toast';
import { IconCalendar, IconRefresh, IconShare, IconTarget, IconTrendingUp } from '../screens/icons';
import { Screen } from '../screens/Screen';
import { Pill, ProgressBar, SkeletonList } from '../screens/ui';

/**
 * Missions — port of PWA routes/missions.tsx: today's missions with
 * progress, claim-all (streak + weekly bonus), per-mission reroll.
 */

const CATEGORY_ICONS: Record<string, { icon: React.ReactNode; label: string }> = {
  easy: { icon: <IconTarget size={13} color={colors.mutedForeground} />, label: 'EASY' },
  medium: { icon: <IconTrendingUp size={13} color={colors.mutedForeground} />, label: 'MEDIUM' },
  viral: { icon: <IconShare size={13} color={colors.mutedForeground} />, label: 'VIRAL' },
  weekly: { icon: <IconCalendar size={13} color={colors.mutedForeground} />, label: 'WEEKLY' },
};

export function MissionsScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const queryClient = useQueryClient();

  const {
    data: missions,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<Mission[]>({
    queryKey: ['missions', 'today'],
    queryFn: () => api.missionsToday(),
    staleTime: 60_000,
    enabled: guarded,
  });

  const claimMutation = useMutation({
    mutationFn: () => api.claimMissions(),
    onSuccess: (data) => {
      toast.success(`Claimed ${data.chips_awarded} chips!`);
      if (data.weekly_bonus_awarded) {
        toast.success('Weekly bonus unlocked! +10,000 chips');
      }
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to claim reward'),
  });

  const rerollMutation = useMutation({
    mutationFn: (missionId: number) => api.rerollMission(missionId),
    onSuccess: () => {
      toast.success('Mission rerolled!');
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to reroll mission'),
  });

  if (!guarded) {
    return (
      <Screen title="Missions" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  const claimable = (missions ?? []).filter((m) => m.completed).length;

  return (
    <Screen
      title="Missions"
      subtitle="Complete daily missions to earn bonus chips."
      onBack={() => router.back()}
      safeEdges={['top']}
      headerRight={
        <PressableScale
          onPress={() => claimMutation.mutate()}
          disabled={claimMutation.isPending || claimable === 0}
        >
          <View
            style={[
              styles.claimBtn,
              (claimMutation.isPending || claimable === 0) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.claimLabel}>
              {claimMutation.isPending
                ? 'CLAIMING…'
                : `CLAIM${claimable > 0 ? ` (${claimable})` : ''}`}
            </Text>
          </View>
        </PressableScale>
      }
    >
      {isLoading ? (
        <SkeletonList rows={4} />
      ) : error || !missions ? (
        <EmptyBlock
          message="Failed to load missions."
          onRetry={() => void refetch()}
          refreshing={isRefetching}
        />
      ) : missions.length === 0 ? (
        <EmptyBlock message="No missions today — check back tomorrow." />
      ) : (
        <View style={styles.listBlock}>
          {missions.map((mission) => {
            const meta = CATEGORY_ICONS[mission.category] ?? CATEGORY_ICONS.easy;
            const pct = mission.target > 0 ? (mission.progress / mission.target) * 100 : 0;
            return (
              <Surface key={mission.id} variant="card" radius={radii.base}>
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={styles.iconWrap}>{meta.icon}</View>
                    <View style={styles.cardBody}>
                      <Text style={styles.description} numberOfLines={2}>
                        {mission.description}
                      </Text>
                      <View style={styles.metaRow}>
                        <Pill label={meta.label} tone="neutral" />
                        <Text style={styles.reward}>
                          +{mission.reward_chips.toLocaleString()} chips
                        </Text>
                      </View>
                    </View>
                    {mission.completed ? (
                      <Pill label="DONE" tone="accent" />
                    ) : (
                      <PressableScale onPress={() => rerollMutation.mutate(mission.id)}>
                        <View style={styles.rerollBtn}>
                          <IconRefresh size={11} color={colors.mutedForeground} />
                        </View>
                      </PressableScale>
                    )}
                  </View>
                  <ProgressBar percentage={pct} />
                  <Text style={styles.progressText}>
                    {mission.progress.toLocaleString()} / {mission.target.toLocaleString()}
                  </Text>
                </View>
              </Surface>
            );
          })}
          {isRefetching ? <Text style={styles.refreshNote}>Refreshing…</Text> : null}
        </View>
      )}
    </Screen>
  );
}

function EmptyBlock({
  message,
  onRetry,
  refreshing,
}: {
  message: string;
  onRetry?: () => void;
  refreshing?: boolean;
}) {
  return (
    <View style={styles.emptyWrap}>
      <AppText variant="body" center style={styles.emptyText}>
        {message}
      </AppText>
      {onRetry ? (
        <PressableScale onPress={onRetry}>
          <View style={styles.retryBtn}>
            <Text style={styles.retryLabel}>{refreshing ? 'RETRYING…' : 'RETRY'}</Text>
          </View>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  listBlock: { gap: 10, paddingBottom: 16 },
  card: { padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0, gap: 6 },
  description: { fontFamily: fonts.body, fontSize: 14, color: colors.onBackground },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reward: { fontFamily: fonts.data, fontSize: 11, color: colors.accent },
  rerollBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: { fontFamily: fonts.data, fontSize: 10, color: colors.mutedForeground },
  refreshNote: {
    fontFamily: fonts.data,
    fontSize: 10,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  claimBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
  },
  claimLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.onAccent,
  },
  buttonDisabled: { opacity: 0.5 },
  emptyWrap: { gap: 12, alignItems: 'center', paddingVertical: 24 },
  emptyText: { color: colors.mutedForeground },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.onBackground,
  },
});
