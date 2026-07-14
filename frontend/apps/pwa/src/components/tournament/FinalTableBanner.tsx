import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { Trans } from '@lingui/react/macro';

interface FinalTableBannerProps {
  visible: boolean;
}

export function FinalTableBanner({ visible }: FinalTableBannerProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -60, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -60, opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[600] bg-gradient-to-r from-tertiary/20 via-tertiary/10 to-tertiary/20 border border-tertiary/40 backdrop-blur-md rounded-full px-6 py-2.5 shadow-[0_0_30px_rgba(78,222,163,0.2)] flex items-center gap-3"
        >
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span className="font-label-caps text-sm uppercase tracking-widest text-tertiary font-bold">
            <Trans>FINAL TABLE</Trans>
          </span>
          <motion.div
            className="w-2 h-2 rounded-full bg-tertiary"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
