import { motion } from 'framer-motion';
import { Wallet, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog } from '@stackbluff/shared/components/Dialog';

interface TournamentBuyInDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  buyIn: number;
  currentBalance: number;
  isProcessing: boolean;
  tournamentName?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export function TournamentBuyInDialog({
  open,
  onClose,
  onConfirm,
  buyIn,
  currentBalance,
  isProcessing,
  tournamentName,
}: TournamentBuyInDialogProps) {
  const canAfford = currentBalance >= buyIn;

  return (
    <Dialog open={open} onClose={onClose} className="max-w-sm">
      <div data-testid="buyin-dialog">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
          <div>
            <h2 className="text-sm font-semibold text-on-surface">Confirm Registration</h2>
            {tournamentName && (
              <p className="text-[11px] text-on-surface-variant mt-0.5">{tournamentName}</p>
            )}
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">Buy-in</span>
            <span className="font-mono text-lg font-bold text-tertiary">{formatCurrency(buyIn)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">Your Balance</span>
            <span className={cn('font-mono text-sm font-bold', canAfford ? 'text-tertiary' : 'text-red-400')}>
              {formatCurrency(currentBalance)}
            </span>
          </div>

          {!canAfford && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
              Insufficient balance. You need {formatCurrency(buyIn - currentBalance)} more.
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/5 flex gap-3">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-white/10 text-on-surface-variant text-[11px] font-label-caps uppercase tracking-wider hover:bg-white/5 transition-all"
          >
            Cancel
          </motion.button>
          <motion.button
            data-testid="confirm-buyin"
            type="button"
            whileHover={canAfford ? { scale: 1.02, boxShadow: '0 0 30px rgba(78,222,163,0.25)' } : undefined}
            whileTap={canAfford ? { scale: 0.95 } : undefined}
            onClick={onConfirm}
            disabled={!canAfford || isProcessing}
            className={cn(
              'flex-1 py-2.5 rounded-lg font-label-caps text-[11px] uppercase tracking-wider transition-all',
              canAfford && !isProcessing
                ? 'bg-tertiary text-on-tertiary shadow-[0_0_20px_rgba(78,222,163,0.15)]'
                : 'bg-white/5 text-on-surface-variant/30 cursor-not-allowed',
            )}
          >
            <Wallet className="w-3.5 h-3.5 inline mr-1.5" />
            {isProcessing ? 'Registering...' : 'Register'}
          </motion.button>
        </div>
      </div>
    </Dialog>
  );
}
