import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { FeedbackSettings } from './FeedbackSettings';

interface FeedbackSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackSettingsDialog({ open, onClose }: FeedbackSettingsDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="fb-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[700] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="fb-panel"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400, duration: 0.3 }}
            className="fixed z-[710] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md max-h-[80vh] flex flex-col rounded-xl bg-[rgba(12,12,12,0.97)] border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Header — fixed at top */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-on-surface">
                  Feedback Settings
                </h2>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Configure haptic and audio feedback
                </p>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Scrollable content — custom scrollbar inside the card */}
            <div className="fb-dialog-scroll overflow-y-auto flex-1 px-5 py-4">
              <FeedbackSettings />
            </div>

            {/* Custom scrollbar styles — transparent track, sleek thumb */}
            <style>{`
              .fb-dialog-scroll::-webkit-scrollbar {
                width: 6px;
              }
              .fb-dialog-scroll::-webkit-scrollbar-track {
                background: transparent;
              }
              .fb-dialog-scroll::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 9999px;
              }
              .fb-dialog-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.2);
              }
              .fb-dialog-scroll {
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
              }
            `}</style>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
