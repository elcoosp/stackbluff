import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api, type HandDetail } from '../lib/api';
import { IconCrown } from '../screens/icons';
import { Screen } from '../screens/Screen';
import { EmptyState, KeyValueRow, SkeletonList } from '../screens/ui';

/**
 * Hand detail — port of PWA routes/hands/$handId.tsx: players + stacks,
 * action timeline per street, winners + pot distribution.
 */

const STREET_ORDER = ['preflop', 'flop', 'turn', 'river', 'showdown'] as const;
const STREET_LABELS: Record<string, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

export function HandDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ handId?: string }>();
  const handId = typeof params.handId === 'string' ? params.handId : '';

  const {
    data: hand,
    isLoading,
    error,
    refetch,
  } = useQuery<HandDetail>({
    queryKey: ['hand', handId],
    queryFn: () => api.hand(handId),
    enabled: !!handId,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <Screen title="Hand" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  if (error || !hand) {
    return (
      <Screen title="Hand" onBack={() => router.back()} safeEdges={['top']}>
        <EmptyState
          title="Failed to load"
          message="Failed to load hand details."
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

  const streets = STREET_ORDER.filter((street) => hand.actions.some((a) => a.street === street));

  return (
    <Screen
      title={`Hand ${hand.id.slice(0, 8)}`}
      subtitle={new Date(hand.played_at).toLocaleString()}
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <View style={styles.flex}>
        {/* Board */}
        {hand.result.community_cards.length > 0 ? (
          <Surface variant="card" radius={radii.base} style={styles.boardCard}>
            <AppText variant="label">BOARD</AppText>
            <View style={styles.boardRow}>
              {hand.result.community_cards.map((card, i) => (
                <View
                  // biome-ignore lint/suspicious/noArrayIndexKey: board cards have no stable id
                  key={i}
                  style={styles.cardFace}
                >
                  <Text style={styles.cardText}>{card}</Text>
                </View>
              ))}
            </View>
          </Surface>
        ) : null}

        {/* Players */}
        <AppText variant="label">PLAYERS</AppText>
        <View style={styles.listBlock}>
          {hand.players.map((player) => (
            <Surface key={player.player_id} variant="card" radius={radii.base}>
              <View style={styles.playerRow}>
                {player.is_dealer ? <IconCrown size={12} color="#facc15" /> : null}
                <Text style={styles.playerName} numberOfLines={1}>
                  {player.display_name || player.player_id.slice(0, 8)}
                </Text>
                {player.hole_cards && player.hole_cards.length > 0 ? (
                  <Text style={styles.playerCards}>{player.hole_cards.join(' ')}</Text>
                ) : null}
                <Text style={styles.playerStack}>
                  {player.stack_before.toLocaleString()} → {player.stack_after.toLocaleString()}
                </Text>
              </View>
            </Surface>
          ))}
        </View>

        {/* Action timeline */}
        {streets.map((street) => (
          <Surface key={street} variant="card" radius={radii.base} style={styles.streetCard}>
            <AppText variant="label">
              {STREET_LABELS[street]?.toUpperCase() ?? street.toUpperCase()}
            </AppText>
            {hand.actions
              .filter((a) => a.street === street)
              .map((action, idx) => {
                const player = hand.players.find((p) => p.player_id === action.player_id);
                return (
                  <KeyValueRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable per-street ordering is meaningful
                    key={`${street}-${idx}`}
                    label={`${player?.display_name || action.player_id.slice(0, 8)} — ${action.action_type}`}
                    value={action.amount != null ? action.amount.toLocaleString() : '—'}
                  />
                );
              })}
          </Surface>
        ))}

        {/* Winners */}
        <AppText variant="label">RESULTS</AppText>
        <View style={styles.listBlock}>
          {hand.result.winners.map((winner) => (
            <Surface
              key={`${winner.player_id}-${winner.amount_won}`}
              variant="card"
              radius={radii.base}
            >
              <View style={styles.winnerRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.winnerName} numberOfLines={1}>
                    {hand.players.find((p) => p.player_id === winner.player_id)?.display_name ||
                      winner.player_id.slice(0, 8)}
                  </Text>
                  <Text style={styles.winnerHand}>{winner.hand_description}</Text>
                </View>
                <Text style={styles.winnerAmount}>+{winner.amount_won.toLocaleString()}</Text>
              </View>
            </Surface>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  listBlock: { gap: 8 },
  boardCard: { padding: 16, gap: 10 },
  boardRow: { flexDirection: 'row', gap: 6 },
  cardFace: {
    minWidth: 44,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radii.base - 4,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    fontFamily: fonts.data,
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  playerName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.onBackground,
  },
  playerCards: { fontFamily: fonts.data, fontSize: 11, color: colors.accent },
  playerStack: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  streetCard: { padding: 14, gap: 4 },
  winnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  winnerName: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.onBackground,
  },
  winnerHand: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  winnerAmount: {
    fontFamily: fonts.data,
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
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
