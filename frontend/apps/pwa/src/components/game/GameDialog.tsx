import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog } from '@/components/ui/Dialog';
import { TimerBar } from './TimerBar';

interface GameDialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  isMyTurn?: boolean;
  timerRemainingMs?: number | null;
  timerTotalMs?: number | null;
  showCloseButton?: boolean;
  className?: string;
}

export function GameDialog({
  open,
  onClose,
  children,
  isMyTurn = false,
  timerRemainingMs = null,
  timerTotalMs = null,
  showCloseButton = true,
  className
}: GameDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} showCloseButton={showCloseButton} className={className}>
      <AnimatePresence>
        {isMyTurn && timerRemainingMs !== null && (
          <motion.div
            key="dialog-timer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden shrink-0"
          >
            <div className="px-4 pt-4">
              <TimerBar remainingMs={timerRemainingMs} totalMs={timerTotalMs ?? null} isActive={true} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </Dialog>
  );
}
