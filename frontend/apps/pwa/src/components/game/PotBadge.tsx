import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

function useAnimatedCounter(target: number, duration = 500) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = valueRef.current;
    const to = target;
    if (from === to) return;

    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setValue(current);
      valueRef.current = current;
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        valueRef.current = to;
        setValue(to);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}

interface PotBadgeProps {
  amount: number;
  toCall?: number;
  isMobile?: boolean;
  showdownReveal: any;
  potRef: React.RefObject<HTMLDivElement>;
  lastAction?: any;
}

export const PotBadge = ({ amount, toCall, isMobile = false, showdownReveal, potRef, lastAction }: PotBadgeProps) => {
  const winners = (showdownReveal?.players ?? []).filter((p: any) => p.is_winner);
  const isShowdown = !!showdownReveal;

  const animatedAmount = useAnimatedCounter(amount);
  const animatedToCall = useAnimatedCounter(toCall || 0);

  const formatAmount = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : n.toString();

  const [effectKey, setEffectKey] = useState(0);

  useEffect(() => {
    if (lastAction && ['bet', 'raise', 'call', 'all-in'].includes(lastAction.action)) {
      setEffectKey((prev) => prev + 1);
    }
  }, [lastAction]);

  const TrophyIcon = ({ className }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      overflow="visible"
    >
      <defs>
        <linearGradient id="trophyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="30%" stopColor="#fbbf24" />
          <stop offset="70%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <g transform="translate(6, 4)">
        <path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978" stroke="url(#trophyGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978" stroke="url(#trophyGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 9h1.5a1 1 0 0 0 0-5H18" stroke="url(#trophyGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 22h16" stroke="url(#trophyGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" stroke="url(#trophyGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="url(#trophyGrad)" fillOpacity="0.15" />
        <path d="M6 9H4.5a1 1 0 0 1 0-5H6" stroke="url(#trophyGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );

  return (
    <div ref={potRef} className="relative font-mono flex items-center justify-center">
      <motion.div
        animate={{
          boxShadow: isShowdown
            ? '0 15px 40px rgba(0,0,0,0.6), 0 0 25px rgba(78,222,163,0.2)'
            : '0 4px 12px rgba(0,0,0,0.5)'
        }}
        className={cn(
          'relative flex items-center justify-center rounded-full border font-data-mono text-center overflow-visible transition-colors duration-300',
          isMobile ? 'px-3 py-1 text-[10px]' : 'px-3 py-1.5 text-[10px]',
          isShowdown
            ? 'border-tertiary/30 bg-[rgba(8,8,8,0.92)] backdrop-blur-md'
            : 'border-white/10 bg-black/60 backdrop-blur-md'
        )}
        transition={{ boxShadow: { duration: 0.5, ease: 'easeOut' } }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isShowdown ? (
            <motion.div
              key="showdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex items-center justify-center gap-2 whitespace-nowrap px-1"
            >
              <TrophyIcon className={cn(isMobile ? "w-4 h-4" : "w-5 h-5", "flex-shrink-0 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]")} />

              {winners.map((w: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 flex-shrink-0">
                  {idx > 0 && <span className="text-white/15">+</span>}
                  <div className="flex flex-col items-start leading-tight">
                    <span className={cn("font-bold text-on-surface tracking-wider uppercase", isMobile ? "text-[11px]" : "text-xs")}>
                      {w.display_name}
                    </span>
                    <span className={cn("font-label-caps tracking-widest text-on-surface-variant uppercase", isMobile ? "text-[9px]" : "text-[10px]")}>
                      {w.hand_description}
                    </span>
                  </div>
                </div>
              ))}

              <span className="text-white/15">|</span>

              <span className={cn("text-tertiary font-bold tabular-nums tracking-wider drop-shadow-[0_0_12px_rgba(78,222,163,0.35)]", isMobile ? "text-sm" : "text-base")}>
                ${formatAmount(Math.round(animatedAmount))}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="pot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="relative flex items-center justify-center gap-2 whitespace-nowrap px-1"
            >
              {/* BORDER BLIP RIPPLE EFFECT */}
              <AnimatePresence>
                {effectKey > 0 && (
                  <motion.div
                    key={effectKey}
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: 2.5, opacity: 0, transition: { duration: 1.2, ease: 'easeOut' } }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 rounded-full pointer-events-none border-2 border-tertiary"
                    style={{ borderColor: 'rgba(78,222,163,0.6)' }}
                  />
                )}
              </AnimatePresence>

              <div className="flex items-center justify-center gap-1 text-center">
                <Coins className={cn('text-tertiary/70', isMobile ? 'w-3 h-3' : 'w-3 h-3')} />
                <span
                  className="bg-clip-text text-transparent text-center tabular-nums"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #4edea3 0%, #6ffbbe 30%, #0cb880 60%, #4edea3 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 5s infinite linear',
                  }}
                >
                  {isMobile ? '' : <Trans>POT </Trans>}
                  ${formatAmount(Math.round(animatedAmount))}
                </span>
              </div>

              {/* ANIMATED WIDTH FOR "TO CALL" SECTION */}
              <motion.div
                className="flex items-center justify-center gap-1 text-center"
                initial={false}
                animate={{ width: toCall && toCall > 0 ? 'auto' : 0, opacity: toCall && toCall > 0 ? 1 : 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                <span className="text-white/15">|</span>
                <Target className={cn('text-tertiary/50', isMobile ? 'w-2.5 h-2.5' : 'w-2.5 h-2.5')} />
                <span className="text-white/50 text-center tabular-nums">
                  {isMobile ? '' : <Trans>CALL </Trans>}
                  <span className="text-tertiary">${formatAmount(Math.round(animatedToCall))}</span>
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
