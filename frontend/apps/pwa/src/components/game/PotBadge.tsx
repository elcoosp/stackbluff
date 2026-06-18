import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { Coins, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';

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

interface PotShowdownBadgeProps {
  amount: number;
  toCall?: number;
  isMobile?: boolean;
  showdownReveal: any;
  potRef: React.RefObject<HTMLDivElement>;
}

export const PotBadge = ({ amount, toCall, isMobile = false, showdownReveal, potRef }: PotShowdownBadgeProps) => {
  const winners = showdownReveal?.players.filter((p: any) => p.is_winner) ?? [];
  const isShowdown = !!showdownReveal;

  const animatedAmount = useAnimatedCounter(amount);
  const animatedToCall = useAnimatedCounter(toCall || 0);

  const formatAmount = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : n.toString();

  const MORPH_DURATION = 0.4;
  const CONTENT_DELAY = 0.45;

  // ── Chip arrival effects ──
  const lastAction = useGameStore((s) => s.lastAction);
  const [effectKey, setEffectKey] = useState(0);

  useEffect(() => {
    if (lastAction && ['bet', 'raise', 'call', 'all-in'].includes(lastAction.action)) {
      setEffectKey((prev) => prev + 1);
    }
  }, [lastAction]);

  // ── Ripple ring configuration ──
  const rippleVariants = {
    initial: { scale: 0.8, opacity: 0.6, borderWidth: '2px' },
    animate: { scale: 2.2, opacity: 0, borderWidth: '1px' },
    exit: { opacity: 0 },
  };

  // ── Badge squash & stretch ──
  const badgeBounceVariants = {
    initial: { scaleX: 1, scaleY: 1 },
    animate: {
      scaleX: [1, 0.96, 1.02, 1],
      scaleY: [1, 1.06, 0.98, 1],
      transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] },
    },
  };

  // ── Number pop ──
  const numberPopVariants = {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.18, 0.95, 1],
      transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
    },
  };

  return (
    <div ref={potRef} className="relative z-30 font-mono flex items-center justify-center">
      <AnimatePresence mode="wait">
        {isShowdown ? (
          <motion.div
            key="showdown"
            initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
            transition={{ duration: MORPH_DURATION, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "flex flex-col items-center justify-center text-center rounded-xl",
              "border border-tertiary/30 bg-[rgba(8,8,8,0.92)] backdrop-blur-xl",
              "shadow-[0_0_40px_rgba(0,0,0,0.8),0_0_20px_rgba(78,222,163,0.1)]",
              isMobile ? "px-5 py-3 min-w-[240px]" : "px-6 py-3 min-w-[260px]",
            )}
          >
            {/* ... winner content (unchanged) ... */}
            <motion.span
              className={cn(
                "font-label-caps tracking-[0.3em] text-tertiary uppercase",
                isMobile ? "text-[8px] mb-1" : "text-[9px] mb-1.5",
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: CONTENT_DELAY, duration: 0.2 }}
            >
              Winner
            </motion.span>

            {winners.map((w: any) => (
              <div key={w.user_id} className="flex flex-col items-center gap-1 w-full">
                <div className={cn("flex items-center gap-3 w-full justify-center", isMobile && "gap-3")}>
                  <div className="flex gap-1.5 perspective-1000">
                    {w.hole_cards.map((c: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ rotateY: 90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        transition={{ delay: CONTENT_DELAY + 0.1 + i * 0.06, duration: 0.25 }}
                        style={{ transformStyle: 'preserve-3d' }}
                      >
                        <Card rank={c.rank} suit={c.suit} size={isMobile ? 'sm' : 'sm'} hoverable={false} />
                      </motion.div>
                    ))}
                  </div>

                  <motion.div
                    className="flex flex-col items-start gap-0.5"
                    initial={{ opacity: 0, x: 4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: CONTENT_DELAY + 0.2, duration: 0.15 }}
                  >
                    <span className={cn(
                      "font-bold text-on-surface tracking-wider uppercase text-left",
                      isMobile ? "text-[11px]" : "text-[11px]",
                    )}>
                      {w.display_name}
                    </span>
                    <span className={cn(
                      "font-label-caps tracking-widest text-on-surface-variant uppercase text-left max-w-[140px] whitespace-normal leading-tight",
                      isMobile ? "text-[8px]" : "text-[8px]",
                    )}>
                      {w.hand_description}
                    </span>
                  </motion.div>
                </div>
              </div>
            ))}

            <motion.div
              className={cn(
                "w-full bg-gradient-to-r from-transparent via-tertiary/30 to-transparent",
                isMobile ? "h-px my-1" : "h-px my-1.5",
              )}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: CONTENT_DELAY + 0.3, duration: 0.15 }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: CONTENT_DELAY + 0.35, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={cn(
                "text-tertiary font-bold tabular-nums tracking-wider drop-shadow-[0_0_12px_rgba(78,222,163,0.35)]",
                isMobile ? "text-xl" : "text-xl",
              )}>
                ${formatAmount(Math.round(animatedAmount))}
              </span>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="pot"
            // ── Badge bounce on chip arrival ──
            variants={badgeBounceVariants}
            initial="initial"
            animate={effectKey > 0 ? "animate" : "initial"}
            className={cn(
              'relative flex items-center justify-center gap-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 font-data-mono text-center',
              isMobile ? 'px-4 py-2 text-[10px]' : 'px-3 py-1.5 text-[10px]',
              toCall && toCall > 0 && 'border-tertiary/20'
            )}
          >
            {/* ── Ripple ring ── */}
            <AnimatePresence>
              {effectKey > 0 && (
                <motion.div
                  key={effectKey}
                  variants={rippleVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="absolute inset-0 rounded-full pointer-events-none border border-tertiary/60"
                  style={{ borderColor: 'rgba(78,222,163,0.6)' }}
                />
              )}
            </AnimatePresence>

            {/* ── Pot content ── */}
            <motion.div
              className="flex items-center justify-center gap-1 text-center"
              initial={{ opacity: 0, scale: 0.9, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: CONTENT_DELAY, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <Coins className={cn('text-tertiary/70', isMobile ? 'w-3.5 h-3.5' : 'w-3 h-3')} />
              <motion.span
                key={animatedAmount} // triggers number pop on amount change
                variants={numberPopVariants}
                initial="initial"
                animate={effectKey > 0 ? "animate" : "initial"}
                className="bg-clip-text text-transparent text-center tabular-nums"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #4edea3 0%, #6ffbbe 30%, #0cb880 60%, #4edea3 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 5s infinite linear',
                }}
              >
                {isMobile ? '' : 'POT '}
                ${formatAmount(Math.round(animatedAmount))}
              </motion.span>
            </motion.div>

            {/* Call indicator – unchanged */}
            {toCall !== undefined && toCall > 0 && (
              <motion.div
                className="flex items-center justify-center gap-1 text-center"
                initial={{ width: 0, opacity: 0, x: -5 }}
                animate={{ width: 'auto', opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: -5 }}
                transition={{ delay: CONTENT_DELAY + 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                <span className="text-white/15">|</span>
                <Target className={cn('text-tertiary/50', isMobile ? 'w-3 h-3' : 'w-2.5 h-2.5')} />
                <span className="text-white/50 text-center tabular-nums">
                  {isMobile ? '' : 'CALL '}
                  <span className="text-tertiary">${formatAmount(Math.round(animatedToCall))}</span>
                </span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
