import { useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { apiClient } from '@stackbluff/shared';
import { Card } from './Card';
import TimeAgo from 'react-timeago-i18n';
import { createPortal } from 'react-dom';

// ── Types ──
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

// ── Helpers ──
function shortId(id: string): string {
  return id.slice(0, 8);
}

// ── STANDARD CARD PARSER ──
const rankFullMap: Record<string, string> = {
  Two: '2', Three: '3', Four: '4', Five: '5',
  Six: '6', Seven: '7', Eight: '8', Nine: '9',
  Ten: '10', Jack: 'J', Queen: 'Q', King: 'K', Ace: 'A'
};
const suitFullMap: Record<string, string> = {
  Spades: '♠', Hearts: '♥', Diamonds: '♦', Clubs: '♣'
};
const shortSuitMap: Record<string, string> = {
  s: '♠', h: '♥', d: '♦', c: '♣'
};
const shortRankMap: Record<string, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  J: 'J', Q: 'Q', K: 'K', A: 'A'
};

function parseCard(cardStr: string): { rank: string; suit: string } {
  const last = cardStr.slice(-1);
  if (shortSuitMap[last]) {
    const rank = cardStr.slice(0, -1);
    const mappedRank = shortRankMap[rank];
    if (mappedRank) {
      return { rank: mappedRank, suit: shortSuitMap[last] };
    }
  }

  const matches = cardStr.match(/[A-Z][a-z]+/g);
  if (matches && matches.length >= 2) {
    const rankFull = matches[0];
    const suitFull = matches[1];
    const rank = rankFullMap[rankFull] || rankFull;
    const suit = suitFullMap[suitFull] || suitFull;
    return { rank, suit };
  }

  return { rank: cardStr, suit: '' };
}

export function HistoryDialog({ open, onClose, tableId }: HistoryDialogProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ['tableHistory', tableId],
      queryFn: ({ pageParam }) =>
        apiClient<HistoryResponse>(
          `/tables/${tableId}/history?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`
        ),
      getNextPageParam: (lastPage) => lastPage.next_cursor,
      initialPageParam: undefined as string | undefined,
      enabled: open,
      staleTime: 60_000,
    });

  const allHistory = data?.pages.flatMap((p) => p.histories) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: hasNextPage ? allHistory.length + 1 : allHistory.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  const items = virtualizer.getVirtualItems();

  const lastItem = items[items.length - 1];
  if (
    lastItem &&
    lastItem.index >= allHistory.length - 1 &&
    hasNextPage &&
    !isFetchingNextPage
  ) {
    fetchNextPage();
  }

  if (typeof document === 'undefined' || !open) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="history-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            key="history-dialog"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400, duration: 0.3 }}
            className="fixed z-[3010] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md rounded-xl bg-[rgba(12,12,12,0.97)] border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Custom Scrollbar Styles */}
            <style>{`
              .history-dialog-scroll::-webkit-scrollbar {
                width: 6px;
              }
              .history-dialog-scroll::-webkit-scrollbar-track {
                background: transparent;
              }
              .history-dialog-scroll::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 9999px;
              }
              .history-dialog-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.2);
              }
              .history-dialog-scroll {
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
              }
            `}</style>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-on-surface">Hand History</h2>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  {total} hands played
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-4 history-dialog-scroll">
              {status === 'pending' && (
                <div className="text-center py-8 text-on-surface-variant text-sm">Loading...</div>
              )}
              {status === 'error' && (
                <div className="text-center py-8 text-red-400 text-sm">Failed to load history.</div>
              )}
              {status === 'success' && allHistory.length === 0 && (
                <div className="text-center py-8 text-on-surface-variant text-sm">No hands played yet.</div>
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
                      className="border-b border-white/5 py-3"
                    >
                      {isLoader ? (
                        <div className="text-center text-on-surface-variant text-xs font-mono py-2">
                          Loading more...
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {/* Time & Pot */}
                          <div className="flex justify-between items-center">
                            <TimeAgo
                              date={hand.played_at}
                              locale="en-US"
                              className="font-mono text-sm text-on-surface"
                            />
                            <span className="font-mono text-tertiary font-bold text-sm">
                              ${hand.pot.toLocaleString()}
                            </span>
                          </div>

                          {/* Community Cards */}
                          {hand.community_cards && hand.community_cards.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {hand.community_cards.map((c, i) => {
                                const { rank, suit } = parseCard(c);
                                return (
                                  <Card
                                    key={i}
                                    rank={rank}
                                    suit={suit}
                                    size="xs"
                                    hoverable={false}
                                    className="w-7 h-10"
                                  />
                                );
                              })}
                            </div>
                          )}

                          {/* Winner Info */}
                          <div className="flex justify-between items-center text-xs text-on-surface-variant">
                            <div className="flex items-center gap-2">
                              <span>Winner: {shortId(hand.winners[0]?.user_id || '')}</span>
                              {hand.winner_hole_cards && hand.winner_hole_cards.length > 0 && (
                                <span className="flex gap-1">
                                  {hand.winner_hole_cards.map((c, i) => {
                                    const { rank, suit } = parseCard(c);
                                    return (
                                      <Card
                                        key={i}
                                        rank={rank}
                                        suit={suit}
                                        size="xs"
                                        hoverable={false}
                                        className="w-6 h-8"
                                      />
                                    );
                                  })}
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-tertiary/60">
                                {hand.winners[0]?.hand_rank || ''}
                              </span>
                            </div>
                            <span className="font-medium text-tertiary">
                              ${hand.winners[0]?.amount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/5 flex gap-3 shrink-0">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="w-full py-2.5 rounded-lg border border-white/10 text-on-surface-variant text-[11px] font-label-caps uppercase tracking-wider hover:bg-white/5 transition-all"
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
