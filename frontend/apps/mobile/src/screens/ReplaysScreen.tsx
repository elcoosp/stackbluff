import { colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type ReplayCard as ReplayCardType } from '../lib/api';
import { toast } from '../lib/toast';
import { IconFilm } from '../screens/icons';
import { Screen } from '../screens/Screen';
import { EmptyState, SkeletonList } from '../screens/ui';

/**
 * Replays — port of PWA routes/replays.tsx: recent notable hands as replay
 * cards (winner, pot, board), share-link copy.
 */

export function ReplaysScreen() {
  const router = useRouter();

  const {
    data: replays,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<ReplayCardType[]>({
    queryKey: ['replays'],
    queryFn: () => api.replays(),
    staleTime: 60_000,
  });

  // expo-clipboard is not in the dependency set — surface the share URL via
  // a toast so the flow completes; swap in expo-clipboard when available.
  const shareLink = (replay: ReplayCardType) => {
    toast.info(`Replay link: ${replay.share_url}`);
  };

  return (
    <Screen
      title="Replays"
      subtitle="Watch the biggest recent pots unfold again."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      {isLoading ? (
        <SkeletonList rows={4} height={110} />
      ) : error ? (
        <EmptyState
          title="Failed to load"
          message="Failed to load replay cards."
          action={
            <PressableScale onPress={() => void refetch()}>
              <View style={styles.cta}>
                <Text style={styles.ctaLabel}>{isRefetching ? 'RETRYING…' : 'RETRY'}</Text>
              </View>
            </PressableScale>
          }
        />
      ) : !replays || replays.length === 0 ? (
        <EmptyState
          icon={<IconFilm size={24} color={colors.mutedForeground} />}
          title="No replays yet"
          message="Notable hands will appear here."
        />
      ) : (
        <View style={styles.listBlock}>
          {replays.map((replay) => (
            <Surface key={replay.id} variant="card" radius={radii.base}>
              <Pressable onPress={() => router.push(`/hands/${replay.id}` as never)}>
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <IconFilm size={13} color={colors.accent} />
                    <Text style={styles.winner} numberOfLines={1}>
                      {replay.winner_name} wins {replay.pot.toLocaleString()}
                    </Text>
                    <Text style={styles.date}>
                      {new Date(replay.played_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.description} numberOfLines={2}>
                    {replay.hand_description}
                  </Text>
                  {replay.community_cards && replay.community_cards.length > 0 ? (
                    <View style={styles.boardRow}>
                      {replay.community_cards.map((card, i) => (
                        <View
                          // biome-ignore lint/suspicious/noArrayIndexKey: board cards have no stable id
                          key={i}
                          style={styles.boardCard}
                        >
                          <Text style={styles.boardCardText}>{card}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <PressableScale onPress={() => shareLink(replay)}>
                    <Text style={styles.shareLink}>COPY SHARE LINK</Text>
                  </PressableScale>
                </View>
              </Pressable>
            </Surface>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listBlock: { gap: 12, paddingBottom: 16 },
  card: { padding: 14, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  winner: {
    flex: 1,
    fontFamily: fonts.data,
    fontSize: 12,
    fontWeight: '700',
    color: colors.onBackground,
  },
  date: { fontFamily: fonts.data, fontSize: 10, color: colors.mutedForeground },
  description: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedForeground },
  boardRow: { flexDirection: 'row', gap: 4 },
  boardCard: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.base - 6,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boardCardText: { fontFamily: fonts.data, fontSize: 11, color: colors.onBackground },
  shareLink: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.accent,
    alignSelf: 'flex-start',
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
