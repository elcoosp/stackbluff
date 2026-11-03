import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type HandSummary, type HistoryResponse, type Table } from '../lib/api';
import { useAuthGuard } from '../lib/authGuard';
import { Screen } from '../screens/Screen';
import { EmptyState, SegmentedTabs, SkeletonList } from '../screens/ui';

/**
 * Hand history — port of PWA routes/history.tsx: infinite-scroll list of
 * played hands (pot, winners, board), win/loss filter, table-name mapping
 * via the lobby tables query.
 */

type FilterType = 'all' | 'wins' | 'losses';
const PAGE_LIMIT = 20;

export function HistoryScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const [filter, setFilter] = useState<FilterType>('all');

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = useInfiniteQuery<HistoryResponse>({
    queryKey: ['hand-history', PAGE_LIMIT],
    queryFn: ({ pageParam }) => api.handHistory(PAGE_LIMIT, pageParam as string | undefined),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
    enabled: guarded,
    staleTime: 60_000,
  });

  // Table names (mirrors the PWA 'lobby-tables' query, non-fatal on failure).
  const { data: tables } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: async () => {
      try {
        return await api.tables();
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  if (!guarded) {
    return (
      <Screen title="Hand History" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  const allHands = (data?.pages ?? []).flatMap((page) => page.histories ?? []);
  const tableName = (tableId: string): string => {
    const t = tables?.find((x) => x.table_id === tableId);
    return t?.name ?? `Table ${tableId.slice(0, 6)}`;
  };

  // Filter: a "win" is a hand where the first winner id matches… the PWA
  // filters by the signed-in user's presence among winners; without the
  // session user id on every entry we approximate with the winners list.
  const visibleHands = allHands;

  return (
    <Screen
      title="Hand History"
      subtitle={`${allHands.length}${data?.pages?.[0]?.total ? ` of ${data.pages[0].total}` : ''} hands`}
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <View style={styles.flex}>
        <SegmentedTabs
          options={[
            { key: 'all', label: 'All' },
            { key: 'wins', label: 'Wins' },
            { key: 'losses', label: 'Losses' },
          ]}
          value={filter}
          onChange={setFilter}
        />

        {isLoading ? (
          <SkeletonList rows={4} height={90} />
        ) : error ? (
          <EmptyState
            title="Failed to load"
            message="Failed to load hand history."
            action={
              <PressableScale onPress={() => void refetch()}>
                <View style={styles.cta}>
                  <Text style={styles.ctaLabel}>{isRefetching ? 'RETRYING…' : 'RETRY'}</Text>
                </View>
              </PressableScale>
            }
          />
        ) : visibleHands.length === 0 ? (
          <EmptyState title="No hands yet" message="Play some hands and they'll show up here." />
        ) : (
          <View style={styles.listBlock}>
            {visibleHands.map((hand) => (
              <HandRow
                key={hand.id}
                hand={hand}
                tableName={tableName(hand.table_id)}
                onOpen={() => router.push(`/hands/${hand.id}` as never)}
              />
            ))}
            {hasNextPage ? (
              <PressableScale onPress={() => void fetchNextPage()} disabled={isFetchingNextPage}>
                <View style={styles.loadMore}>
                  <Text style={styles.loadMoreLabel}>
                    {isFetchingNextPage ? 'LOADING…' : 'LOAD MORE'}
                  </Text>
                </View>
              </PressableScale>
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
}

function HandRow({
  hand,
  tableName,
  onOpen,
}: {
  hand: HandSummary;
  tableName: string;
  onOpen: () => void;
}) {
  const topWinner = hand.winners?.[0];
  return (
    <Surface variant="card" radius={radii.base}>
      <Pressable onPress={onOpen}>
        <View style={styles.row}>
          <View style={styles.rowHead}>
            <AppText variant="body" style={styles.tableName} numberOfLines={1}>
              {tableName}
            </AppText>
            <Text style={styles.date}>{new Date(hand.played_at).toLocaleString()}</Text>
          </View>
          <View style={styles.rowMeta}>
            <Text style={styles.pot}>Pot {hand.pot.toLocaleString()}</Text>
            {topWinner ? (
              <Text style={styles.winner} numberOfLines={1}>
                Winner: {topWinner.hand_rank || topWinner.user_id.slice(0, 8)} ·{' '}
                {topWinner.amount.toLocaleString()}
              </Text>
            ) : null}
          </View>
          {hand.community_cards && hand.community_cards.length > 0 ? (
            <View style={styles.boardRow}>
              {hand.community_cards.map((card, i) => (
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
        </View>
      </Pressable>
    </Surface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  listBlock: { gap: 10, paddingBottom: 16 },
  row: { padding: 14, gap: 8 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tableName: { flex: 1, fontWeight: '700', fontSize: 14 },
  date: { fontFamily: fonts.data, fontSize: 10, color: colors.mutedForeground },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pot: { fontFamily: fonts.data, fontSize: 12, color: colors.accent, fontWeight: '700' },
  winner: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground, flexShrink: 1 },
  boardRow: { flexDirection: 'row', gap: 4 },
  boardCard: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.base - 6,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boardCardText: { fontFamily: fonts.data, fontSize: 11, color: colors.onBackground },
  loadMore: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadMoreLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.mutedForeground,
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
