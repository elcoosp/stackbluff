import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  showCloseButton?: boolean;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  children,
  showCloseButton = true,
  className,
}: DialogProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog Container */}
          <motion.div
            key="dialog"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400, duration: 0.3 }}
            className={cn(
              'fixed z-[2010] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm rounded-xl bg-[rgba(12,12,12,0.97)] border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]',
              className,
            )}
          >
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-on-surface transition-colors z-20"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {children}
          </motion.div>

          {/* Custom Scrollbar Styles */}
          <style>{`
            .dialog-scroll::-webkit-scrollbar {
              width: 6px;
            }
            .dialog-scroll::-webkit-scrollbar-track {
              background: transparent;
            }
            .dialog-scroll::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.1);
              border-radius: 9999px;
            }
            .dialog-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.2);
            }
            .dialog-scroll {
              scrollbar-width: thin;
              scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
            }
          `}</style>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
