import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BlindLevelNotificationProps {
  tournamentId: string;
}

export function BlindLevelNotification({ tournamentId }: BlindLevelNotificationProps) {
  const [notification, setNotification] = useState<{
    level: number;
    blinds: { smallBlind: number; bigBlind: number };
  } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.tournamentId === tournamentId && detail.blinds) {
        setNotification({ level: detail.level, blinds: detail.blinds });
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), 3000);
        return () => clearTimeout(timer);
      }
    };
    window.addEventListener('tournament:blindLevel', handler as EventListener);
    return () => window.removeEventListener('tournament:blindLevel', handler as EventListener);
  }, [tournamentId]);

  return (
    <AnimatePresence>
      {visible && notification && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[600] bg-surface-container/90 backdrop-blur-md border border-tertiary/30 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3"
        >
          <TrendingUp className="w-5 h-5 text-tertiary" />
          <div>
            <div className="font-label-caps text-[10px] uppercase tracking-wider text-tertiary">
              <Trans>Blind Level {notification.level}</Trans>
            </div>
            <div className="font-data-mono text-sm text-on-surface">
              {notification.blinds.smallBlind} / {notification.blinds.bigBlind}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
