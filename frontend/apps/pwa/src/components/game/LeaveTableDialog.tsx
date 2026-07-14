import { motion } from 'framer-motion';
import { LogOut, AlertTriangle } from 'lucide-react';
import { Dialog } from '@stackbluff/shared/components/Dialog';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface LeaveTableDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stackAmount: number;
  isHandInProgress: boolean;
}

export function LeaveTableDialog({
  open,
  onClose,
  onConfirm,
  stackAmount,
  isHandInProgress,
}: LeaveTableDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} className="max-w-sm">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-on-surface"><Trans>Leave Table</Trans></h2>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
            <Trans>Returning to balance</Trans>
          </span>
          <span className="font-mono text-sm font-bold text-tertiary">
            ${stackAmount.toLocaleString()}
          </span>
        </div>

        {isHandInProgress && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-300">
              <span className="font-bold"><Trans>Hand in progress.</Trans></span>{' '}
              <Trans>You will be seated out and your chips returned after the hand completes.</Trans>
            </div>
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
          <Trans>Stay</Trans>
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={onConfirm}
          className="flex-1 py-2.5 rounded-lg bg-red-500/80 text-white font-label-caps text-[11px] uppercase tracking-wider hover:bg-red-500 transition-all"
        >
          <LogOut className="w-3.5 h-3.5 inline mr-1.5" />
          <Trans>Leave</Trans>
        </motion.button>
      </div>
    </Dialog>
  );
}
