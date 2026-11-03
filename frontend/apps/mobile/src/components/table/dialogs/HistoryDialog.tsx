/**
 * HistoryDialog — native port of PWA `components/game/HistoryDialog.tsx`.
 *
 * Hand-history list for the table: infinite pages of 20
 * (`GET /tables/{id}/history`), "My hands only" filter, per-hand card with
 * played-at / pot / winner-count header row, mini community cards
 * (NativeCard xs) and the winner line. The PWA virtualizes rows with
 * @tanstack/react-virtual — on RN a recycled FlatList provides the same
 * windowing (documented deviation; no hand-detail route navigation on
 * mobile yet — the row is not a Link, A5 owns that route).
 */
import { apiClient } from '@stackbluff/shared/src/api/client';
import { fonts as FONTS, NativeCard } from '@stackbluff/ui-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useAuthStore } from '../../../stores/authStore';
import { parseCard } from '../format';
import { CalendarIcon, ChevronRightIcon, CoinsIcon, EyeIcon, UsersIcon } from '../icons';
import { DialogShell } from './DialogShell';

interface WinnerSummary {
  user_id: string;
  amount: number;
  hand_rank: string;
}

interface HandSummary {
  id: string;
  table_id: string;
  played_at: string;
  pot: number;
  winners: WinnerSummary[];
  community_cards: string[];
  winner_hole_cards?: string[];
}

interface HistoryResponse {
  histories: HandSummary[];
  total: number;
  next_cursor?: string;
}

export interface HistoryDialogProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function HistoryDialog({ open, onClose, tableId }: HistoryDialogProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ['tableHistory', tableId, showOnlyMine],
    queryFn: ({ pageParam }) =>
      apiClient<HistoryResponse>(
        `/tables/${tableId}/history?limit=20${pageParam ? `&cursor=${pageParam}` : ''}${
          showOnlyMine && userId ? `&user_id=${userId}` : ''
        }`,
      ),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
    enabled: open && !!tableId,
    staleTime: 60_000,
  });

  const allHistory = useMemo(
    () => query.data?.pages.flatMap((p) => p.histories) ?? [],
    [query.data],
  );
  const total = query.data?.pages[0]?.total ?? 0;

  return (
    <DialogShell open={open} onClose={onClose} maxWidth={672}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#e2e2e2' }}>Hand History</Text>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontSize: 12, color: '#c7c6cb' }}>{total} hands</Text>
          </View>
          <Pressable
            onPress={() => setShowOnlyMine((p) => !p)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            accessibilityLabel="My hands only"
          >
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                borderWidth: 1,
                borderColor: showOnlyMine ? '#4edea3' : 'rgba(255,255,255,0.2)',
                backgroundColor: showOnlyMine ? '#4edea3' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showOnlyMine && (
                <Text style={{ fontSize: 9, color: '#003824', fontWeight: '700' }}>✓</Text>
              )}
            </View>
            <Text style={{ fontSize: 12, color: '#c7c6cb' }}>My hands only</Text>
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <FlatList
        style={{ maxHeight: 420 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 10 }}
        data={allHistory}
        keyExtractor={(h) => h.id}
        renderItem={({ item: hand }) => {
          const iWon = hand.winners.some((w) => w.user_id === userId);
          return (
            <View
              style={{
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: iWon ? 'rgba(78,222,163,0.2)' : 'rgba(255,255,255,0.1)',
                backgroundColor: iWon ? 'rgba(78,222,163,0.05)' : 'transparent',
              }}
            >
              {/* Top row: time, pot, winner count */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <CalendarIcon size={12} color="rgba(199,198,203,0.5)" />
                  <Text style={{ fontSize: 12, color: '#c7c6cb' }}>
                    {new Date(hand.played_at).toLocaleString()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <CoinsIcon size={12} color="rgba(78,222,163,0.7)" />
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#4edea3',
                      fontFamily: FONTS.data,
                      fontWeight: '700',
                    }}
                  >
                    ${hand.pot}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(199,198,203,0.5)' }}>|</Text>
                  <UsersIcon size={12} color="rgba(199,198,203,0.5)" />
                  <Text style={{ fontSize: 12, color: '#c7c6cb' }}>
                    {hand.winners.length} {hand.winners.length === 1 ? 'winner' : 'winners'}
                  </Text>
                </View>
              </View>

              {/* Community cards preview */}
              {(hand.community_cards?.length ?? 0) > 0 && (
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                  {hand.community_cards.map((card) => {
                    const { rank, suit } = parseCard(card);
                    return <NativeCard key={card} rank={rank} suit={suit} width={32} rounded={3} />;
                  })}
                </View>
              )}

              {/* Winner info */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: '#c7c6cb' }}>Winner:</Text>
                  <Text style={{ fontSize: 12, color: '#e2e2e2', fontWeight: '500' }}>
                    {hand.winners[0]?.user_id === userId
                      ? 'You'
                      : shortId(hand.winners[0]?.user_id || '')}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(199,198,203,0.5)' }}>
                    {hand.winners[0]?.hand_rank || ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <EyeIcon size={12} color="#4edea3" />
                  <Text style={{ fontSize: 12, color: '#4edea3' }}>View</Text>
                  <ChevronRightIcon size={12} color="#4edea3" />
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          query.isPending ? (
            <Text style={{ textAlign: 'center', paddingVertical: 32, color: '#c7c6cb' }}>
              Loading...
            </Text>
          ) : query.isError ? (
            <Text style={{ textAlign: 'center', paddingVertical: 32, color: '#f87171' }}>
              Failed to load history.
            </Text>
          ) : (
            <Text style={{ textAlign: 'center', paddingVertical: 32, color: '#c7c6cb' }}>
              No hands played yet.
            </Text>
          )
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage();
          }
        }}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View>
              <Text
                style={{ textAlign: 'center', paddingVertical: 16, fontSize: 14, color: '#c7c6cb' }}
              >
                Loading more...
              </Text>
            </View>
          ) : undefined
        }
      />

      {/* Footer */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.05)',
          flexDirection: 'row',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={onClose}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ fontSize: 14, color: '#c7c6cb' }}>Close</Text>
        </Pressable>
      </View>
    </DialogShell>
  );
}
