import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RaiseSlider } from './RaiseSlider';
import { cn } from '@/lib/utils';
import {
  Bot,
  Zap,
  RotateCcw,
  Infinity,
  LogOut,
  DollarSign,
  TrendingUp,
  Swords,
  Check,
} from 'lucide-react';
import type { PreAction } from '../../hooks/usePreAction';
import { trackPlayerAction } from '@/lib/customAnalytics';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

// Helper: format currency with "k" shorthand
function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    const k = (amount / 1000).toFixed(1);
    return `$${k}k`;
  }
  return `$${amount}`;
}

const glassStyle: React.CSSProperties = {
  background: 'rgba(8, 8, 8, 0.85)',
  backdropFilter: 'blur(32px)',
  WebkitBackdropFilter: 'blur(32px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderTopColor: 'rgba(255,255,255,0.14)',
  boxShadow:
    '0 12px 48px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
};

const transition = { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const };

const MOBILE_BREAK = 390;

// Hook to keep banner visible for a minimum duration
function useVisibleAction(action: string | null, amount: number, delay = 2500) {
  const [visible, setVisible] = useState<{ action: string; amount: number } | null>(null);
  const prevActionRef = useRef<string | null>(null);

  useEffect(() => {
    if (action && action !== prevActionRef.current) {
      setVisible({ action, amount });
    }
    prevActionRef.current = action;
  }, [action, amount]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setVisible(null);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [visible, delay]);

  return visible;
}

// Hook for Random Sparkle Effect
function useRandomSparkle(enabled: boolean) {
  const [sparkIndex, setSparkIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSparkIndex(null);
      return;
    }

    let timeout1: ReturnType<typeof setTimeout>;
    let timeout2: ReturnType<typeof setTimeout>;

    const run = () => {
      timeout1 = setTimeout(() => {
        setSparkIndex(Math.floor(Math.random() * 4));
        timeout2 = setTimeout(() => {
          setSparkIndex(null);
          run();
        }, 800);
      }, 2000 + Math.random() * 3000);
    };

    run();

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [enabled]);

  return sparkIndex;
}

// Keyboard handler
function useActionKeys(
  onAction: (action: string, amount?: number) => void,
  onToggleRaise: () => void,
  actionRequired: boolean,
  toCall: number,
) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!actionRequired) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case 'f':
          onAction('fold');
          break;
        case 'c':
          onAction(toCall === 0 ? 'check' : 'call');
          break;
        case 'r':
          onToggleRaise();
          break;
        case 'a':
          onAction('all-in');
          break;
      }
    },
    [onAction, onToggleRaise, actionRequired, toCall],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);
}

// Responsive width hook
function useViewportWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 500);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

// Pre-action definitions
const preActionOptions: {
  key: PreAction['type'];
  label: string;
  shortLabel: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
    { key: 'fold', label: t`Fold`, shortLabel: t`Fold`, Icon: LogOut },
    { key: 'check_or_fold', label: t`Check / Fold`, shortLabel: t`Chk/Fld`, Icon: RotateCcw },
    { key: 'check_or_call_any', label: t`Call Any`, shortLabel: t`Call Any`, Icon: Infinity },
  ];

// Variant config
const variantConfig: Record<
  string,
  {
    Icon: React.FC<{ className?: string }>;
    activeBg: string;
    activeBorder: string;
    activeText: string;
    activeGlow: string;
    hoverBg: string;
    hoverBorder: string;
    hoverGlow: string;
    disabledBg: string;
    disabledBorder: string;
    disabledText: string;
  }
> = {
  fold: {
    Icon: LogOut,
    activeBg: 'rgba(239,68,68,0.06)',
    activeBorder: 'rgba(239,68,68,0.25)',
    activeText: '#f87171',
    activeGlow: '0 0 12px rgba(239,68,68,0.1)',
    hoverBg: 'rgba(239,68,68,0.1)',
    hoverBorder: 'rgba(239,68,68,0.35)',
    hoverGlow: '0 0 18px rgba(239,68,68,0.12)',
    disabledBg: 'rgba(239,68,68,0.02)',
    disabledBorder: 'rgba(239,68,68,0.08)',
    disabledText: 'rgba(248,113,113,0.22)',
  },
  call: {
    Icon: DollarSign,
    activeBg: 'rgba(78,222,163,0.06)',
    activeBorder: 'rgba(78,222,163,0.25)',
    activeText: '#4edea3',
    activeGlow: '0 0 12px rgba(78,222,163,0.1)',
    hoverBg: 'rgba(78,222,163,0.1)',
    hoverBorder: 'rgba(78,222,163,0.35)',
    hoverGlow: '0 0 18px rgba(78,222,163,0.12)',
    disabledBg: 'rgba(78,222,163,0.02)',
    disabledBorder: 'rgba(78,222,163,0.08)',
    disabledText: 'rgba(78,222,163,0.22)',
  },
  raise: {
    Icon: TrendingUp,
    activeBg: 'rgba(255,255,255,0.04)',
    activeBorder: 'rgba(255,255,255,0.15)',
    activeText: 'rgba(255,255,255,0.85)',
    activeGlow: '0 0 8px rgba(255,255,255,0.04)',
    hoverBg: 'rgba(255,255,255,0.07)',
    hoverBorder: 'rgba(255,255,255,0.22)',
    hoverGlow: '0 0 14px rgba(255,255,255,0.06)',
    disabledBg: 'rgba(255,255,255,0.02)',
    disabledBorder: 'rgba(255,255,255,0.06)',
    disabledText: 'rgba(255,255,255,0.15)',
  },
  'all-in': {
    Icon: Swords,
    activeBg: 'rgba(245,158,11,0.06)',
    activeBorder: 'rgba(245,158,11,0.25)',
    activeText: '#fbbf24',
    activeGlow: '0 0 12px rgba(245,158,11,0.1)',
    hoverBg: 'rgba(245,158,11,0.1)',
    hoverBorder: 'rgba(245,158,11,0.35)',
    hoverGlow: '0 0 18px rgba(245,158,11,0.12)',
    disabledBg: 'rgba(245,158,11,0.02)',
    disabledBorder: 'rgba(245,158,11,0.08)',
    disabledText: 'rgba(251,191,36,0.22)',
  },
};

// Subtle hover hook
function useSubtleHover(cfg: typeof variantConfig[string], disabled: boolean) {
  const [hovered, setHovered] = useState(false);
  const isDisabled = disabled;

  const style: React.CSSProperties = {
    background: isDisabled ? cfg.disabledBg : hovered ? cfg.hoverBg : cfg.activeBg,
    borderColor: isDisabled ? cfg.disabledBorder : hovered ? cfg.hoverBorder : cfg.activeBorder,
    borderWidth: 1,
    borderStyle: 'solid',
    color: isDisabled ? cfg.disabledText : cfg.activeText,
    boxShadow: isDisabled ? 'none' : hovered ? cfg.hoverGlow : cfg.activeGlow,
    transition:
      'background 0.3s ease, border-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease',
  };

  const handlers = {
    onMouseEnter: () => !isDisabled && setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  return { style, handlers, hovered };
}

// Action button with motion
const ActionBtn = ({
  variant,
  onClick,
  disabled,
  shortcut,
  children,
  className = '',
  isMobile = false,
  IconOverride,
  sparkId,
  currentSpark,
}: {
  variant: 'fold' | 'call' | 'raise' | 'all-in';
  onClick: () => void;
  disabled: boolean;
  shortcut?: string;
  children: React.ReactNode;
  className?: string;
  isMobile?: boolean;
  IconOverride?: React.ComponentType<{ className?: string }>;
  sparkId?: number;
  currentSpark?: number | null;
}) => {
  const cfg = variantConfig[variant];
  const { Icon: DefaultIcon } = cfg;
  const Icon = IconOverride || DefaultIcon;
  const { style, handlers } = useSubtleHover(cfg, disabled);
  const isSparking = sparkId !== undefined && currentSpark === sparkId;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex items-center justify-center gap-1.5 md:gap-2 px-2.5 md:px-3.5 py-3 md:py-3.5 rounded-lg cursor-pointer select-none w-full h-full overflow-hidden ${className}`}
      style={style}
      {...handlers}
      whileHover={!disabled ? { scale: 1.04, transition: { duration: 0.15 } } : {}}
      whileTap={!disabled ? { scale: 0.94, transition: { duration: 0.1 } } : {}}
    >
      {/* Random Light Sweep Effect */}
      {isSparking && (
        <motion.div
          initial={{ x: '-150%', opacity: 0 }}
          animate={{ x: '250%', opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.8, ease: 'easeInOut', times: [0, 0.2, 0.8, 1] }}
          className="absolute inset-y-0 w-1/3 pointer-events-none z-10"
          style={{
            background: `linear-gradient(90deg, transparent, ${cfg.activeText}40, transparent)`,
            transform: 'skewX(-20deg)',
          }}
        />
      )}

      <Icon className="w-4 h-4 shrink-0 relative z-20" />
      <span className="text-[10px] md:text-[11px] font-label-caps uppercase tracking-wide relative z-20 whitespace-nowrap">{children}</span>
      {shortcut && !isMobile && (
        <kbd
          className="text-[8px] font-mono uppercase tracking-wider px-1 py-px rounded relative z-20"
          style={{
            color: disabled ? cfg.disabledText : cfg.activeText,
            opacity: disabled ? 0.4 : 0.45,
            background: disabled ? 'transparent' : 'rgba(255,255,255,0.05)',
            transition: 'color 0.3s ease, background 0.3s ease',
          }}
        >
          {shortcut}
        </kbd>
      )}
    </motion.button>
  );
};

// Execution Banner
const ExecutionBanner = ({
  visibleAction,
}: {
  visibleAction: { action: string; amount: number } | null;
}) => {
  const action = visibleAction?.action;
  const amount = visibleAction?.amount;

  const isCall = action?.toLowerCase() === 'call';
  const actionText = action || '';
  const amountText = (isCall && amount && amount > 0) ? ` $${amount}` : '';
  const displayText = (t`Auto ${actionText}` + amountText).trim();

  return (
    <AnimatePresence>
      {action && (
        <motion.div
          key="exec-banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden mx-3 flex items-center justify-center gap-1.5 py-1.5 text-tertiary"
        >
          <Zap className="w-3 h-3" />
          <span className="text-[9px] font-label-caps uppercase tracking-widest">
            {displayText}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Pre-action panel
const PreActionPanel = ({
  preAction,
  onSetPreAction,
  toCall,
  compact,
}: {
  preAction: PreAction | null;
  onSetPreAction: (pa: PreAction | null) => void;
  toCall: number;
  compact?: boolean;
}) => {
  const [callUpToValue, setCallUpToValue] = useState('100');
  const [callUpToEditing, setCallUpToEditing] = useState(false);

  const handleClick = (type: PreAction['type']) => {
    if (preAction?.type === type) onSetPreAction(null);
    else onSetPreAction({ type } as PreAction);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {preActionOptions.map((opt) => {
          const isSelected = preAction?.type === opt.key;
          const { Icon } = opt;
          return (
            <motion.button
              key={opt.key}
              type="button"
              onClick={() => handleClick(opt.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-label-caps uppercase tracking-wider border cursor-pointer select-none transition-colors duration-200 ${isSelected
                ? 'border-tertiary bg-tertiary/15 text-tertiary'
                : 'border-white/8 bg-white/[0.03] text-white/30 hover:text-white/50 hover:border-white/12'
                }`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{compact ? opt.shortLabel : opt.label}</span>
            </motion.button>
          );
        })}
      </div>

      {toCall > 0 && (
        <div className="flex items-center gap-1.5">
          {callUpToEditing ? (
            <div className="flex-1 flex items-center gap-1.5 py-2 px-2.5 rounded-lg border border-tertiary/40 bg-black/30">
              <span className="text-[9px] text-tertiary/50 shrink-0"><Trans>Call ≤ $</Trans></span>
              <input
                type="number"
                value={callUpToValue}
                onChange={(e) => setCallUpToValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const n = parseInt(callUpToValue, 10);
                    if (!isNaN(n) && n > 0)
                      onSetPreAction({ type: 'call_up_to', amount: n });
                    setCallUpToEditing(false);
                  }
                  if (e.key === 'Escape') {
                    setCallUpToEditing(false);
                    onSetPreAction(null);
                  }
                }}
                onBlur={() => setCallUpToEditing(false)}
                autoFocus
                className="flex-1 bg-transparent text-[10px] text-tertiary font-data-mono outline-none border-none min-w-0"
              />
            </div>
          ) : (
            <motion.button
              type="button"
              onClick={() => {
                if (preAction?.type === 'call_up_to') onSetPreAction(null);
                else setCallUpToEditing(true);
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-label-caps uppercase tracking-wider border cursor-pointer select-none transition-colors duration-200 ${preAction?.type === 'call_up_to'
                ? 'border-tertiary bg-tertiary/15 text-tertiary'
                : 'border-white/8 bg-white/[0.03] text-white/30 hover:text-white/50 hover:border-white/12'
                }`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
            >
              {preAction?.type === 'call_up_to'
                ? t`Call ≤ $${(preAction as { type: 'call_up_to'; amount: number }).amount}`
                : t`Call ≤ $…`}
            </motion.button>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {preAction && (
          <motion.div
            key="queued-status"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-center gap-1.5 py-0.5">
              <span className="w-1 h-1 rounded-full bg-tertiary animate-pulse" />
              <span className="text-[9px] text-tertiary/50 font-label-caps uppercase tracking-widest">
                <Trans>Queued</Trans>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────
   DESKTOP
   ──────────────────────────────────────────────────────────────── */
const DesktopActionBar = ({
  actionRequired,
  toCall,
  minRaise,
  maxRaise,
  pot,
  bigBlind,
  onAction,
  preAction,
  onSetPreAction,
  executingAction,
  heroTimerRemainingMs,
  heroTimerTotalMs,
  canRaise,
  heroStack,
}: {
  actionRequired: boolean;
  toCall: number;
  minRaise: number;
  maxRaise: number;
  pot: number;
  bigBlind: number;
  onAction: (action: string, amount?: number) => void;
  preAction: PreAction | null;
  onSetPreAction: (pa: PreAction | null) => void;
  executingAction: string | null;
  heroTimerRemainingMs?: number | null;
  heroTimerTotalMs?: number | null;
  canRaise: boolean;
  heroStack: number;
}) => {
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [preActionOpen, setPreActionOpen] = useState(false);
  const [actionSent, setActionSent] = useState(false);
  const actionSentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCheck = toCall === 0;
  const isAllInCall = heroStack > 0 && heroStack < toCall;
  const callLabel = isCheck
    ? t`Check`
    : isAllInCall
      ? t`All-in ${formatCurrency(heroStack)}`
      : t`Call ${formatCurrency(toCall)}`;

  const allInDisabled = !actionRequired || heroStack === 0;

  const handleAction = useCallback((action: string, amount?: number) => {
    onAction(action, amount);
    trackPlayerAction(action, amount, pot);
    setActionSent(true);
    if (actionSentTimerRef.current) clearTimeout(actionSentTimerRef.current);
    actionSentTimerRef.current = setTimeout(() => setActionSent(false), 2500);
  }, [onAction]);

  const toggleRaise = useCallback(() => setRaiseOpen((p) => !p), []);
  const visibleAction = useVisibleAction(executingAction, toCall);

  const isActing = !!visibleAction || actionSent;
  const layoutActionRequired = actionRequired || isActing;

  useActionKeys(handleAction, toggleRaise, actionRequired, toCall);

  const sparkIndex = useRandomSparkle(!actionRequired && !raiseOpen);

  const getPreActionLabel = () => {
    if (!preAction) return t`Auto`;
    const label = preAction.type.replace(/_/g, ' ');
    return t`Auto: ${label}`;
  };

  return (
    <motion.div
      key="desktop-bar"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={transition}
      className="relative mx-auto w-fit z-[450] pointer-events-none pb-2"
    >
      <div
        className={cn(
          "pointer-events-auto rounded-2xl overflow-hidden",
          actionRequired && "action-bar-breathing"
        )}
        style={glassStyle}
      >
        <ExecutionBanner visibleAction={visibleAction} />

        <AnimatePresence mode="wait">
          {raiseOpen && actionRequired && canRaise && (
            <RaiseSlider
              key="desktop-raise-slider"
              min={minRaise || 10}
              max={maxRaise || 1000}
              step={bigBlind || 10}
              pot={pot || 0}
              bigBlind={bigBlind || 10}
              onConfirm={(amt) => {
                handleAction('raise', amt);
                setRaiseOpen(false);
              }}
              onCancel={() => setRaiseOpen(false)}
              isOpen={raiseOpen}
              timerRemainingMs={heroTimerRemainingMs}
              timerTotalMs={heroTimerTotalMs}
            />
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {preActionOpen && !layoutActionRequired && (
            <motion.div
              key="desktop-preaction"
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 8 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="px-4 pt-3 pb-1">
                <PreActionPanel
                  preAction={preAction}
                  onSetPreAction={onSetPreAction}
                  toCall={toCall}
                />
              </div>
              <div className="mx-4 border-t border-white/5" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2.5 px-3.5 py-3.5">
          {!layoutActionRequired && (
            <motion.button
              type="button"
              onClick={() => setPreActionOpen(!preActionOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-3.5 rounded-lg border cursor-pointer select-none transition-colors duration-200 ${preAction
                ? 'border-tertiary/30 bg-tertiary/10 text-tertiary'
                : 'border-white/8 bg-white/[0.03] text-white/25 hover:text-white/40 hover:border-white/12'
                }`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-label-caps uppercase tracking-wider whitespace-nowrap">
                {getPreActionLabel()}
              </span>
            </motion.button>
          )}

          <ActionBtn variant="fold" onClick={() => handleAction('fold')} disabled={!actionRequired} shortcut="F" isMobile={false} sparkId={0} currentSpark={sparkIndex}>
            <Trans>Fold</Trans>
          </ActionBtn>
          <ActionBtn variant="call" onClick={() => handleAction(isCheck ? 'check' : 'call')} disabled={!actionRequired} shortcut="C" isMobile={false} IconOverride={isCheck ? Check : undefined} sparkId={1} currentSpark={sparkIndex}>
            {callLabel}
          </ActionBtn>
          <ActionBtn variant="raise" onClick={toggleRaise} disabled={!actionRequired || !canRaise} shortcut="R" isMobile={false} sparkId={2} currentSpark={sparkIndex}>
            {raiseOpen ? t`Close` : t`Raise`}
          </ActionBtn>
          <ActionBtn variant="all-in" onClick={() => handleAction('all-in')} disabled={allInDisabled} shortcut="A" isMobile={false} sparkId={3} currentSpark={sparkIndex}>
            <Trans>All-in</Trans>
          </ActionBtn>
        </div>
      </div>
    </motion.div>
  );
};

/* ────────────────────────────────────────────────────────────────
   MOBILE
   ──────────────────────────────────────────────────────────────── */
const MobileActionBar = ({
  actionRequired,
  toCall,
  minRaise,
  maxRaise,
  pot,
  bigBlind,
  onAction,
  preAction,
  onSetPreAction,
  executingAction,
  heroTimerRemainingMs,
  heroTimerTotalMs,
  canRaise,
  heroStack,
}: {
  actionRequired: boolean;
  toCall: number;
  minRaise: number;
  maxRaise: number;
  pot: number;
  bigBlind: number;
  onAction: (action: string, amount?: number) => void;
  preAction: PreAction | null;
  onSetPreAction: (pa: PreAction | null) => void;
  executingAction: string | null;
  heroTimerRemainingMs?: number | null;
  heroTimerTotalMs?: number | null;
  canRaise: boolean;
  heroStack: number;
}) => {
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionSent, setActionSent] = useState(false);
  const actionSentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCheck = toCall === 0;
  const isAllInCall = heroStack > 0 && heroStack < toCall;
  const callLabel = isCheck
    ? t`Check`
    : isAllInCall
      ? t`All-in ${formatCurrency(heroStack)}`
      : t`Call ${formatCurrency(toCall)}`;

  const allInDisabled = !actionRequired || heroStack === 0;

  const handleAction = useCallback((action: string, amount?: number) => {
    onAction(action, amount);
    trackPlayerAction(action, amount, pot);
    setActionSent(true);
    if (actionSentTimerRef.current) clearTimeout(actionSentTimerRef.current);
    actionSentTimerRef.current = setTimeout(() => setActionSent(false), 2500);
  }, [onAction]);

  const vw = useViewportWidth();
  const isNarrow = vw < MOBILE_BREAK;
  const toggleRaise = useCallback(() => setRaiseOpen((p) => !p), []);
  const visibleAction = useVisibleAction(executingAction, toCall);

  const isActing = !!visibleAction || actionSent;
  const layoutActionRequired = actionRequired || isActing;

  useActionKeys(handleAction, toggleRaise, actionRequired, toCall);

  const sparkIndex = useRandomSparkle(!actionRequired && !raiseOpen);

  const getPreActionText = () => {
    if (!preAction) return '';
    return preAction.type.replace(/_/g, ' ');
  };

  const foldBtn = (
    <ActionBtn variant="fold" onClick={() => handleAction('fold')} disabled={!actionRequired} isMobile sparkId={0} currentSpark={sparkIndex}>
      <Trans>Fold</Trans>
    </ActionBtn>
  );
  const callBtn = (
    <ActionBtn variant="call" onClick={() => handleAction(isCheck ? 'check' : 'call')} disabled={!actionRequired} isMobile IconOverride={isCheck ? Check : undefined} sparkId={1} currentSpark={sparkIndex}>
      {callLabel}
    </ActionBtn>
  );
  const raiseBtn = (
    <ActionBtn variant="raise" onClick={toggleRaise} disabled={!actionRequired || !canRaise} isMobile sparkId={2} currentSpark={sparkIndex}>
      {raiseOpen ? t`Close` : t`Raise`}
    </ActionBtn>
  );
  const allInBtn = (
    <ActionBtn variant="all-in" onClick={() => handleAction('all-in')} disabled={allInDisabled} isMobile sparkId={3} currentSpark={sparkIndex}>
      <Trans>All-in</Trans>
    </ActionBtn>
  );

  return (
    <motion.div
      key="mobile-bar"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={transition}
      className="relative w-full z-[450] pointer-events-auto"
    >
      <div
        className={cn(
          "border-x-0 border-b-0 rounded-none",
          actionRequired && "action-bar-breathing"
        )}
        style={glassStyle}
      >
        <ExecutionBanner visibleAction={visibleAction} />

        <AnimatePresence initial={false}>
          {drawerOpen && !layoutActionRequired && (
            <motion.div
              key="mobile-preaction"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2">
                <PreActionPanel
                  preAction={preAction}
                  onSetPreAction={onSetPreAction}
                  toCall={toCall}
                  compact
                />
              </div>
              <div className="mx-3 border-t border-white/5" />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {raiseOpen && actionRequired && canRaise ? (
            <RaiseSlider
              key="mobile-raise-slider"
              min={minRaise || 10}
              max={maxRaise || 1000}
              step={bigBlind || 10}
              pot={pot || 0}
              bigBlind={bigBlind || 10}
              onConfirm={(amt) => {
                handleAction('raise', amt);
                setRaiseOpen(false);
              }}
              onCancel={() => setRaiseOpen(false)}
              isOpen={raiseOpen}
              timerRemainingMs={heroTimerRemainingMs}
              timerTotalMs={heroTimerTotalMs}
            />
          ) : (
            <div className="px-3 py-3 space-y-2">
              {isNarrow ? (
                <>
                  <div className="grid grid-cols-[1fr_2.5fr] gap-2">
                    {foldBtn}
                    {callBtn}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {raiseBtn}
                    {allInBtn}
                  </div>
                </>
              ) : (
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 min-w-0">{foldBtn}</div>
                  <div className="flex-[1.4] min-w-0">{callBtn}</div>
                  <div className="flex-1 min-w-0">{raiseBtn}</div>
                  <div className="flex-1 min-w-0">{allInBtn}</div>
                </div>
              )}

              {!layoutActionRequired && (
                <motion.button
                  type="button"
                  onClick={() => setDrawerOpen(!drawerOpen)}
                  className={`w-full py-2 rounded-lg border text-[9px] font-label-caps uppercase tracking-widest text-center cursor-pointer transition-colors duration-200 flex items-center justify-center gap-1.5 ${preAction
                    ? 'border-tertiary/30 bg-tertiary/10 text-tertiary'
                    : 'border-white/6 bg-white/[0.02] text-white/20 hover:text-white/35 hover:border-white/10'
                    }`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Bot className="w-3 h-3 shrink-0" />
                  {preAction ? t`Auto: ${getPreActionText()}` : t`Auto`}
                </motion.button>
              )}
            </div>
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
  bigBlind = 10,
  onAction,
  preAction,
  onSetPreAction,
  executingAction,
  heroTimerRemainingMs,
  heroTimerTotalMs,
  canRaise,
  heroStack,
}: {
  isDesktop: boolean;
  actionRequired: boolean;
  toCall: number;
  minRaise: number;
  maxRaise: number;
  pot: number;
  bigBlind?: number;
  onAction: (action: string, amount?: number) => void;
  preAction: PreAction | null;
  onSetPreAction: (pa: PreAction | null) => void;
  executingAction: string | null;
  heroTimerRemainingMs?: number | null;
  heroTimerTotalMs?: number | null;
  canRaise: boolean;
  heroStack: number;
}) => {
  const props = {
    actionRequired,
    toCall,
    minRaise,
    maxRaise,
    pot,
    bigBlind,
    onAction,
    preAction,
    onSetPreAction,
    executingAction,
    heroTimerRemainingMs,
    heroTimerTotalMs,
    canRaise,
    heroStack,
  };
  return (
    <>
      <style>{`
        @keyframes actionBarBreath {
          0%, 100% {
            box-shadow: 0 12px 48px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0px rgba(78,222,163,0);
          }
          50% {
            box-shadow: 0 12px 48px rgba(0,0,0,0.9), 0 0 0 2px rgba(78,222,163,0.6), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 35px rgba(78,222,163,0.5);
          }
        }
        .action-bar-breathing {
          animation: actionBarBreath 2s infinite ease-in-out;
        }
      `}</style>
      <AnimatePresence mode="wait">
        {isDesktop ? (
          <DesktopActionBar key="desktop" {...props} />
        ) : (
          <MobileActionBar key="mobile" {...props} />
        )}
      </AnimatePresence>
    </>
  );
};
