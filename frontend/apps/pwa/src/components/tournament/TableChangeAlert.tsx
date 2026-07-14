import { motion, AnimatePresence } from 'framer-motion';
import { Move, ArrowRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface TableChangeAlertProps {
  open: boolean;
  newRoomId: string;
  newSeat: number;
  onAcknowledge: () => void;
}

export function TableChangeAlert({
  open,
  newRoomId,
  newSeat,
  onAcknowledge,
}: TableChangeAlertProps) {
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
            onClick={onAcknowledge}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed z-[3010] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm bg-[rgba(12,12,12,0.97)] border border-white/10 backdrop-blur-xl rounded-xl shadow-2xl p-6"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-tertiary/10 flex items-center justify-center">
                <Move className="w-8 h-8 text-tertiary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-on-surface"><Trans>Table Change</Trans></h2>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  <Trans>You have been moved to a new table.</Trans>
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-on-surface-variant bg-white/5 px-4 py-2 rounded-lg w-full justify-center">
                <span className="font-data-mono"><Trans>Table {newRoomId.slice(0, 6)}</Trans></span>
                <ArrowRight className="w-3 h-3 text-tertiary" />
                <span className="font-data-mono"><Trans>Seat {newSeat + 1}</Trans></span>
              </div>
              <Button
                onClick={onAcknowledge}
                className="w-full bg-tertiary text-on-tertiary font-label-caps text-[11px] uppercase tracking-wider hover:bg-tertiary-fixed"
              >
                <Trans>Go to Table</Trans>
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
