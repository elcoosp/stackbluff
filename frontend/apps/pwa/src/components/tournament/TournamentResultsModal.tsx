import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, X, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import type { TournamentResultEntry } from '@stackbluff/shared/types/tournament.types';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface TournamentResultsModalProps {
  open: boolean;
  results: TournamentResultEntry[];
  tournamentId: string;
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function getMedal(position: number): string {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return `${position}`;
}

export function TournamentResultsModal({ open, results, tournamentId, onClose }: TournamentResultsModalProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const myResult = results.find((r) => r.user_id === userId);
  const winner = results.find((r) => r.position === 1);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed z-[3010] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md max-h-[80vh] bg-[rgba(12,12,12,0.97)] border border-white/10 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-tertiary" />
                <h2 className="text-sm font-semibold text-on-surface"><Trans>Tournament Complete</Trans></h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Winner celebration */}
            {winner && (
              <div className="px-5 py-4 bg-tertiary/5 border-b border-white/5 flex items-center gap-4">
                <div className="text-3xl">🏆</div>
                <div>
                  <div className="text-xs text-on-surface-variant"><Trans>Winner</Trans></div>
                  <div className="font-semibold text-on-surface">{winner.display_name || winner.user_id.slice(0, 8)}</div>
                  <div className="font-data-mono text-tertiary text-sm">{formatCurrency(winner.prize)}</div>
                </div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="ml-auto"
                >
                  <Sparkles className="w-6 h-6 text-yellow-400" />
                </motion.div>
              </div>
            )}

            {/* Results list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 dialog-scroll">
              <div className="space-y-1.5">
                {results.map((result) => {
                  const isMe = result.user_id === userId;
                  const isTop3 = result.position <= 3;
                  return (
                    <div
                      key={result.user_id}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg transition-colors',
                        isMe ? 'bg-tertiary/10 border border-tertiary/20' : 'hover:bg-white/5',
                        isTop3 && !isMe && 'bg-white/5'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'w-6 text-center font-mono text-sm',
                          isTop3 ? 'text-tertiary font-bold' : 'text-on-surface-variant'
                        )}>
                          {getMedal(result.position)}
                        </span>
                        <span className={cn('text-sm', isMe ? 'text-tertiary font-semibold' : 'text-on-surface')}>
                          {result.display_name || result.user_id.slice(0, 8)}
                          {isMe && ' (You)'}
                        </span>
                      </div>
                      <span className="font-data-mono text-sm text-tertiary">
                        {formatCurrency(result.prize)}
                      </span>
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
                className="w-full py-2.5 rounded-lg bg-tertiary text-on-tertiary font-label-caps text-[11px] uppercase tracking-wider hover:bg-tertiary-fixed transition-all"
              >
                <Trans>Return to Lobby</Trans>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
