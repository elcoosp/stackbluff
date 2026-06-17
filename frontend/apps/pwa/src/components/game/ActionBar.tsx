import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActionButton } from './ActionButton';
import { RaiseSlider } from './RaiseSlider';
import { ChevronUp, ChevronDown } from 'lucide-react';

const glassStyle: React.CSSProperties = {
  background: 'rgba(8, 8, 8, 0.8)',
  backdropFilter: 'blur(32px)',
  WebkitBackdropFilter: 'blur(32px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderTopColor: 'rgba(255,255,255,0.14)',
  boxShadow:
    '0 12px 48px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
};

const transition = { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const };

function useActionKeys(onAction: (action: string, amount?: number) => void, actionRequired: boolean) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!actionRequired) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    switch (e.key.toLowerCase()) {
      case 'f': onAction('fold'); break;
      case 'c': onAction('call'); break;
      case 'r': onAction('raise'); break;
      case 'a': onAction('all-in'); break;
    }
  }, [onAction, actionRequired]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);
}

/* ── Desktop ── */
const DesktopActionBar = ({
  actionRequired,
  toCall,
  minRaise,
  maxRaise,
  pot,
  onAction,
}: {
  actionRequired: boolean;
  toCall: number;
  minRaise: number;
  maxRaise: number;
  pot: number;
  onAction: (action: string, amount?: number) => void;
}) => {
  const [raiseOpen, setRaiseOpen] = useState(false);
  useActionKeys(onAction, actionRequired);
  const isCheck = toCall === 0;

  return (
    <motion.div
      key="desktop-bar"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={transition}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[450]"
    >
      <div className="rounded-2xl overflow-hidden" style={glassStyle}>
        <AnimatePresence mode="wait">
          {raiseOpen && actionRequired && (
            <RaiseSlider
              key="desktop-raise-slider"
              min={minRaise || 10}
              max={maxRaise || 1000}
              step={10}
              pot={pot || 0}
              onConfirm={(amt) => { onAction('raise', amt); setRaiseOpen(false); }}
              onCancel={() => setRaiseOpen(false)}
              isOpen={raiseOpen}
            />
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 px-4 py-3">
          <ActionButton variant="fold" onClick={() => onAction('fold')} disabled={!actionRequired} shortcut="F">
            Fold
          </ActionButton>
          <ActionButton
            variant="call"
            onClick={() => onAction(isCheck ? 'check' : 'call')}
            disabled={!actionRequired}
            shortcut="C"
          >
            {isCheck ? 'Check' : `Call $${toCall}`}
          </ActionButton>
          <ActionButton
            variant="raise"
            onClick={() => setRaiseOpen(!raiseOpen)}
            disabled={!actionRequired}
            shortcut="R"
          >
            {raiseOpen ? (
              <span className="flex items-center gap-1">Raise <ChevronUp className="w-3 h-3" /></span>
            ) : (
              <span className="flex items-center gap-1">Raise <ChevronDown className="w-3 h-3" /></span>
            )}
          </ActionButton>
          <ActionButton variant="all-in" onClick={() => onAction('all-in')} disabled={!actionRequired} shortcut="A">
            All-in
          </ActionButton>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Mobile ── */
const MobileActionBar = ({
  actionRequired,
  toCall,
  minRaise,
  maxRaise,
  pot,
  onAction,
}: {
  actionRequired: boolean;
  toCall: number;
  minRaise: number;
  maxRaise: number;
  pot: number;
  onAction: (action: string, amount?: number) => void;
}) => {
  const [raiseOpen, setRaiseOpen] = useState(false);
  const isCheck = toCall === 0;

  const buttonVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
    exit: {
      opacity: 0,
      y: 10,
      transition: { duration: 0.15, ease: 'easeOut' as const },
    },
  };

  return (
    <motion.div
      key="mobile-bar"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={transition}
      className="fixed bottom-0 left-0 right-0 z-[450] pointer-events-auto"
    >
      <div style={glassStyle} className="border-x-0 border-b-0 rounded-none">
        <AnimatePresence mode="wait">
          {raiseOpen && actionRequired ? (
            <RaiseSlider
              key="mobile-raise-slider"
              min={minRaise || 10}
              max={maxRaise || 1000}
              step={10}
              pot={pot || 0}
              onConfirm={(amt) => { onAction('raise', amt); setRaiseOpen(false); }}
              onCancel={() => setRaiseOpen(false)}
              isOpen={raiseOpen}
            />
          ) : (
            <motion.div
              key="mobile-buttons"
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="px-2 py-2 space-y-1.5"
            >
              <div className="grid grid-cols-[1fr_2.5fr] gap-1.5">
                <ActionButton isMobile variant="fold" onClick={() => { onAction('fold'); }} disabled={!actionRequired}>
                  Fold
                </ActionButton>
                <ActionButton isMobile variant="call" onClick={() => { onAction(isCheck ? 'check' : 'call'); }} disabled={!actionRequired}>
                  {isCheck ? 'Check' : `Call $${toCall}`}
                </ActionButton>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <ActionButton isMobile variant="raise" onClick={() => setRaiseOpen(!raiseOpen)} disabled={!actionRequired}>
                  Raise
                </ActionButton>
                <ActionButton isMobile variant="all-in" onClick={() => { onAction('all-in'); }} disabled={!actionRequired}>
                  All-in
                </ActionButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/* ── Export ── */
export const ActionBar = ({
  isDesktop,
  actionRequired,
  toCall,
  minRaise,
  maxRaise,
  pot,
  onAction,
}: {
  isDesktop: boolean;
  actionRequired: boolean;
  toCall: number;
  minRaise: number;
  maxRaise: number;
  pot: number;
  onAction: (action: string, amount?: number) => void;
}) => {
  const props = { actionRequired, toCall, minRaise, maxRaise, pot, onAction };

  return (
    <AnimatePresence mode="wait">
      {isDesktop ? (
        <DesktopActionBar key="desktop" {...props} />
      ) : (
        <MobileActionBar key="mobile" {...props} />
      )}
    </AnimatePresence>
  );
};
