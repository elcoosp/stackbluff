import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { Coins, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

// ── Hook to animate number increments/decrements ──
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
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
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

  // Animate the pot and toCall amounts
  const animatedAmount = useAnimatedCounter(amount);
  const animatedToCall = useAnimatedCounter(toCall || 0);

  const formatAmount = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : n.toString();

  return (
    <motion.div
      ref={potRef}
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-30 font-mono flex items-center justify-center transition-all duration-500"
    >
      <AnimatePresence mode="wait">
        {isShowdown ? (
          <motion.div
            key="showdown"
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center justify-center text-center px-8 py-5 rounded-xl border border-tertiary/30 bg-[rgba(8,8,8,0.92)] backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.8),0_0_20px_rgba(78,222,163,0.1)] min-w-[260px]"
          >
            <span className="text-[9px] font-label-caps tracking-[0.3em] text-tertiary uppercase mb-4">
              Winner
            </span>

            {winners.map((w: any) => (
              <div key={w.user_id} className="flex flex-col items-center justify-center gap-3 w-full">
                <div className="flex gap-3 mb-2 perspective-1000 justify-center">
                  {w.hole_cards.map((c: any, i: number) => (
                    <motion.div
                      key={i}
                      initial={{ rotateY: 90, opacity: 0, y: -10 }}
                      animate={{ rotateY: 0, opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      <Card rank={c.rank} suit={c.suit} size="sm" hoverable={false} />
                    </motion.div>
                  ))}
                </div>

                <div className="flex flex-col items-center justify-center gap-1 w-full">
                  <span className="text-[12px] font-bold text-on-surface tracking-wider uppercase text-center">
                    {w.display_name}
                  </span>
                  <span className="text-[10px] font-label-caps tracking-widest text-on-surface-variant uppercase text-center max-w-[180px] whitespace-normal">
                    {w.hand_description}
                  </span>
                </div>
              </div>
            ))}

            <div className="h-px w-24 bg-gradient-to-r from-transparent via-tertiary/40 to-transparent my-4" />

            <span className="text-2xl text-tertiary font-bold tabular-nums tracking-wider drop-shadow-[0_0_15px_rgba(78,222,163,0.4)] text-center">
              ${formatAmount(Math.round(animatedAmount))}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="pot"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'flex items-center justify-center gap-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 font-data-mono px-3 py-1.5 text-center',
              isMobile ? 'text-[8px]' : 'text-[10px]',
              toCall && toCall > 0 && 'border-tertiary/20'
            )}
          >
            <motion.div className="flex items-center justify-center gap-1 text-center" layout>
              <Coins className={cn('text-tertiary/70', isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3')} />
              <span
                className="bg-clip-text text-transparent text-center tabular-nums"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #4edea3 0%, #6ffbbe 30%, #0cb880 60%, #4edea3 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 5s infinite linear',
                }}
              >
                {isMobile ? '' : 'POT '}
                ${formatAmount(Math.round(animatedAmount))}
              </span>
            </motion.div>

            {toCall !== undefined && toCall > 0 && (
              <motion.div
                className="flex items-center justify-center gap-1 text-center"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                <span className="text-white/15">|</span>
                <Target className={cn('text-tertiary/50', isMobile ? 'w-2 h-2' : 'w-2.5 h-2.5')} />
                <span className="text-white/50 text-center tabular-nums">
                  {isMobile ? '' : 'CALL '}
                  <span className="text-tertiary">${formatAmount(Math.round(animatedToCall))}</span>
                </span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
