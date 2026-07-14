import { useAuthStore } from "@stackbluff/shared/stores/authStore";
import { useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, ChevronRight, Calendar, Users, Coins } from 'lucide-react';
import { apiClient } from '@stackbluff/shared';
import { Card } from './Card';
import TimeAgo from 'react-timeago-i18n';
import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Trans, t, Plural } from '@lingui/react/macro';

// Types
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

interface HistoryDialogProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
}

// Helpers
function shortId(id: string): string {
  return id.slice(0, 8);
}

function parseCard(cardStr: string): { rank: string; suit: string } {
  const rankMap: Record<string, string> = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
    J: 'J', Q: 'Q', K: 'K', A: 'A'
  };
  const suitMap: Record<string, string> = {
    s: '♠', h: '♥', d: '♦', c: '♣'
  };
  const rank = cardStr.slice(0, -1);
  const suit = cardStr.slice(-1);
  return { rank: rankMap[rank] || rank, suit: suitMap[suit] || suit };
}

export function HistoryDialog({ open, onClose, tableId }: HistoryDialogProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ['tableHistory', tableId, showOnlyMine],
      queryFn: ({ pageParam }) =>
        apiClient<HistoryResponse>(
          `/tables/${tableId}/history?limit=20${pageParam ? `&cursor=${pageParam}` : ''}${showOnlyMine ? `&user_id=${userId}` : ''}`
        ),
      getNextPageParam: (lastPage) => lastPage.next_cursor,
      initialPageParam: undefined as string | undefined,
      enabled: open && !!tableId,
      staleTime: 60_000,
    });

  const allHistory = data?.pages.flatMap((p) => p.histories) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const virtualizer = useVirtualizer({
    count: hasNextPage ? allHistory.length + 1 : allHistory.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 140,
    overscan: 5,
  });

  const items = virtualizer.getVirtualItems();
  const lastItem = items[items.length - 1];
  if (lastItem && lastItem.index >= allHistory.length - 1 && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }

  if (typeof document === 'undefined' || !open) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="history-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="history-dialog"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400, duration: 0.3 }}
            className="fixed z-[5010] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl max-h-[80vh] bg-[rgba(12,12,12,0.97)] border border-white/10 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-on-surface"><Trans>Hand History</Trans></h2>
                <span className="text-xs text-on-surface-variant bg-white/5 px-2 py-0.5 rounded-full">
                  <Trans>{total} hands</Trans>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyMine}
                    onChange={() => setShowOnlyMine(!showOnlyMine)}
                    className="accent-tertiary"
                  />
                  <Trans>My hands only</Trans>
                </label>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-4 dialog-scroll">
              {status === 'pending' && (
                <div className="flex justify-center py-8 text-on-surface-variant"><Trans>Loading...</Trans></div>
              )}
              {status === 'error' && (
                <div className="text-center py-8 text-red-400"><Trans>Failed to load history.</Trans></div>
              )}
              {status === 'success' && allHistory.length === 0 && (
                <div className="text-center py-8 text-on-surface-variant"><Trans>No hands played yet.</Trans></div>
              )}

              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  position: 'relative',
                  width: '100%',
                }}
              >
                {items.map((virtualItem) => {
                  const idx = virtualItem.index;
                  const isLoader = idx >= allHistory.length;
                  const hand = allHistory[idx];

                  return (
                    <div
                      key={virtualItem.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      {isLoader ? (
                        <div className="py-4 text-center text-on-surface-variant text-sm">
                          <Trans>Loading more...</Trans>
                        </div>
                      ) : (
                        <Link
                          to="/hands/$handId"
                          params={{ handId: hand.id }}
                          className="block group"
                        >
                          <div className={cn(
                            'p-3 rounded-lg border transition-colors hover:border-tertiary/30',
                            hand.winners.some(w => w.user_id === userId)
                              ? 'border-tertiary/20 bg-tertiary/5'
                              : 'border-white/10'
                          )}>
                            {/* Top row: time, pot, winner count */}
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-on-surface-variant/50" />
                                <span className="text-on-surface-variant">
                                  {new Date(hand.played_at).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Coins className="w-3 h-3 text-tertiary/70" />
                                <span className="font-mono text-tertiary font-bold">
                                  ${hand.pot}
                                </span>
                                <span className="text-on-surface-variant/50">|</span>
                                <Users className="w-3 h-3 text-on-surface-variant/50" />
                                <span className="text-on-surface-variant">
                                  <Plural
                                    value={hand.winners.length}
                                    one="# winner"
                                    other="# winners"
                                  />
                                </span>
                              </div>
                            </div>

                            {/* Community cards preview */}
                            {hand.community_cards && hand.community_cards.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {hand.community_cards.map((card, idx) => {
                                  const { rank, suit } = parseCard(card);
                                  return (
                                    <Card
                                      key={idx}
                                      rank={rank}
                                      suit={suit}
                                      size="xs"
                                      hoverable={false}
                                      className="w-8 h-11"
                                    />
                                  );
                                })}
                              </div>
                            )}

                            {/* Winner info */}
                            <div className="flex items-center justify-between mt-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-on-surface-variant"><Trans>Winner:</Trans></span>
                                <span className="text-on-surface font-medium">
                                  {hand.winners[0]?.user_id === userId ? t`You` : shortId(hand.winners[0]?.user_id || '')}
                                </span>
                                <span className="text-on-surface-variant/50">
                                  {hand.winners[0]?.hand_rank || ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-tertiary">
                                <Eye className="w-3 h-3" />
                                <span className="group-hover:underline"><Trans>View</Trans></span>
                                <ChevronRight className="w-3 h-3" />
                              </div>
                            </div>
                          </div>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/5 flex justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-white/10 text-on-surface-variant text-sm hover:bg-white/5 transition-colors"
              >
                <Trans>Close</Trans>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
