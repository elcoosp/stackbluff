import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TimerBar } from '@/components/game/TimerBar';

interface TournamentCountdownOverlayProps {
  tournamentId: string;
  onComplete: () => void;
}

export function TournamentCountdownOverlay({
  tournamentId,
  onComplete,
}: TournamentCountdownOverlayProps) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.tournamentId === tournamentId && detail.startsInSeconds) {
        setSeconds(detail.startsInSeconds);
        setVisible(true);
      }
    };
    window.addEventListener('tournament:starting', handler as EventListener);
    return () => window.removeEventListener('tournament:starting', handler as EventListener);
  }, [tournamentId]);

  useEffect(() => {
    if (seconds === null || seconds <= 0) {
      if (visible) {
        setVisible(false);
        onComplete();
      }
      return;
    }
    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          setVisible(false);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds, visible, onComplete]);

  if (!visible || seconds === null) return null;

  const totalMs = seconds * 1000;
  const remainingMs = seconds * 1000;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            className="text-center"
          >
            <Trophy className="w-16 h-16 text-tertiary mx-auto mb-6" />
            <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter">
              <Trans>Tournament Starting</Trans>
            </h1>
            <p className="text-on-surface-variant text-sm mt-2 font-label-caps tracking-wider">
              <Trans>Sit & Go</Trans>
            </p>

            <div className="mt-8 flex flex-col items-center">
              <div className="font-data-mono text-8xl font-bold text-tertiary tabular-nums">
                {seconds}
              </div>
              <div className="mt-4 w-64">
                <TimerBar remainingMs={remainingMs} totalMs={totalMs} isActive />
              </div>
              <p className="text-on-surface-variant text-xs mt-4 font-label-caps tracking-widest uppercase">
                <Trans>Preparing your table...</Trans>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
