import { useEntitlementsStore } from '../../stores/entitlementsStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { Minimize2, Maximize2 } from 'lucide-react';

const glassPanel: React.CSSProperties = {
  background: 'rgba(10, 10, 10, 0.75)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderTopColor: 'rgba(255,255,255,0.18)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
};

// ── Hook to animate number increments/decrements ──
function useAnimatedCounter(target: number, duration = 800) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

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
        requestAnimationFrame(step);
      } else {
        valueRef.current = to;
        setValue(to);
      }
    };

    const rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return value;
}

/* ── Tactical Oracle — desktop bottom-left ── */
export const TacticalOracle = ({
  winProb,
  potOdds,
}: {
  winProb: number;
  potOdds: number;
}) => {
  const [expanded, setExpanded] = useState(true);
  const animatedWinProb = useAnimatedCounter(winProb);
  const animatedPotOdds = useAnimatedCounter(potOdds);

  const displayWinProb = Math.round(animatedWinProb);
  const displayPotOdds = animatedPotOdds.toFixed(1);

  return (
    <
      {hasActiveSeasonPass() && (
        <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
          Unlimited
        </span>
      )}
    motion.div
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-5 left-5 z-[460] pointer-events-auto"
    >
      <div style={glassPanel} className="rounded-xl px-4 py-3 min-w-[180px] flex flex-col">
        <div className="flex items-center justify-between gap-3 w-full">
          {!expanded ? (
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-tertiary font-bold">{displayWinProb}%</span>
              <span className="text-white/20">|</span>
              <span className="text-on-surface font-bold">{displayPotOdds}:1</span>
            </div>
          ) : (
            <span className="text-[9px] font-mono tracking-[0.2em] text-on-surface-variant uppercase">
              Tactical Oracle
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center"
          >
            {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden space-y-2"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold text-tertiary tabular-nums">{displayWinProb}</span>
                <span className="text-xs font-mono text-tertiary/60">win%</span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent origin-left" />
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-mono font-bold text-on-surface tabular-nums">{displayPotOdds}</span>
                <span className="text-xs font-mono text-on-surface-variant">:1 odds</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/* ── Hand Strength — desktop bottom-right ── */
export const HandStrength = ({
  bestHand,
  strength,
}: {
  bestHand: string;
  strength: number;
}) => {
  const [expanded, setExpanded] = useState(true);
  const animatedStrength = useAnimatedCounter(strength);
  const displayStrength = Math.round(animatedStrength);

  const strengthColor = displayStrength >= 70 ? 'text-tertiary' : displayStrength >= 40 ? 'text-amber-400' : 'text-red-400';
  const barColor = displayStrength >= 70 ? 'bg-tertiary' : displayStrength >= 40 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-5 right-5 z-[460] pointer-events-auto"
    >
      <div style={glassPanel} className="rounded-xl px-4 py-3 min-w-[180px] flex flex-col">
        <div className="flex items-center justify-between gap-3 w-full">
          {!expanded ? (
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-on-surface font-bold uppercase">{bestHand}</span>
              <span className="text-white/20">|</span>
              <span className={`${strengthColor} font-bold`}>{displayStrength}</span>
            </div>
          ) : (
            <span className="text-[9px] font-mono tracking-[0.2em] text-on-surface-variant uppercase">
              Hand Strength
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center"
          >
            {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden space-y-2"
            >
              <div className="text-sm font-mono font-bold text-on-surface uppercase tracking-wider">
                {bestHand}
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent origin-right" />
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className={`text-2xl font-mono font-bold tabular-nums ${strengthColor}`}>{displayStrength}</span>
                  <span className="text-xs font-mono text-on-surface-variant">/ 100</span>
                </div>
                <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${barColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${displayStrength}%` }}
                    transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/* ── Mobile Analytics Strip — slides down from header ── */
export const MobileAnalyticsStrip = ({
  winProb,
  potOdds,
  bestHand,
  strength,
}: {
  winProb: number;
  potOdds: number;
  bestHand: string;
  strength: number;
}) => {
  const animatedWinProb = useAnimatedCounter(winProb);
  const animatedPotOdds = useAnimatedCounter(potOdds);
  const animatedStrength = useAnimatedCounter(strength);

  const displayWinProb = Math.round(animatedWinProb);
  const displayPotOdds = animatedPotOdds.toFixed(1);
  const displayStrength = Math.round(animatedStrength);

  const strengthColor = displayStrength >= 70 ? 'text-tertiary' : displayStrength >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-0 left-0 right-0 z-30 pointer-events-none"
    >
      <div
        className="flex items-center justify-between px-3 py-2 mx-2 mt-1 rounded-b-xl"
        style={{
          background: 'rgba(8, 8, 8, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderBottomColor: 'rgba(255,255,255,0.1)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        <motion.div
          className="text-center"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-[9px] font-mono tracking-[0.15em] text-on-surface-variant uppercase">Win%</div>
          <div className="text-sm font-mono font-bold text-tertiary tabular-nums">{displayWinProb}%</div>
        </motion.div>
        <div className="h-5 w-px bg-white/10" />
        <motion.div
          className="text-center"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-[9px] font-mono tracking-[0.15em] text-on-surface-variant uppercase">Odds</div>
          <div className="text-sm font-mono font-bold text-on-surface tabular-nums">{displayPotOdds}:1</div>
        </motion.div>
        <div className="h-5 w-px bg-white/10" />
        <motion.div
          className="text-center"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-[9px] font-mono tracking-[0.15em] text-on-surface-variant uppercase">Hand</div>
          <div className="text-[11px] font-mono font-bold text-on-surface uppercase">{bestHand}</div>
        </motion.div>
        <div className="h-5 w-px bg-white/10" />
        <motion.div
          className="text-center"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-[9px] font-mono tracking-[0.15em] text-on-surface-variant uppercase">Str</div>
          <div className={`text-sm font-mono font-bold tabular-nums ${strengthColor}`}>{displayStrength}</div>
        </motion.div>
      </div>
    </motion.div>
  );
};
