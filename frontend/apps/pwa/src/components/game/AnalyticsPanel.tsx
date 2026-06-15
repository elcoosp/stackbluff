import { motion } from 'framer-motion';

const glassPanel: React.CSSProperties = {
  background: 'rgba(10, 10, 10, 0.75)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderTopColor: 'rgba(255,255,255,0.18)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
};

/* ── Tactical Oracle — desktop bottom-left ── */
export const TacticalOracle = ({
  winProb,
  potOdds,
}: {
  winProb: number;
  potOdds: number;
}) => (
  <motion.div
    initial={{ x: -60, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className="fixed bottom-5 left-5 z-[460] pointer-events-none"
  >
    <div style={glassPanel} className="rounded-xl px-4 py-3 min-w-[150px] space-y-2">
      <motion.div
        initial={{ x: -15, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="text-[9px] font-mono tracking-[0.2em] text-on-surface-variant uppercase"
      >
        Tactical Oracle
      </motion.div>
      <motion.div
        initial={{ x: -15, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-baseline gap-2"
      >
        <span className="text-2xl font-mono font-bold text-tertiary tabular-nums">{winProb}</span>
        <span className="text-xs font-mono text-tertiary/60">win%</span>
      </motion.div>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.45, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent origin-left"
      />
      <motion.div
        initial={{ x: -15, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-baseline gap-2"
      >
        <span className="text-lg font-mono font-bold text-on-surface tabular-nums">{potOdds}</span>
        <span className="text-xs font-mono text-on-surface-variant">:1 odds</span>
      </motion.div>
    </div>
  </motion.div>
);

/* ── Hand Strength — desktop bottom-right ── */
export const HandStrength = ({
  bestHand,
  strength,
}: {
  bestHand: string;
  strength: number;
}) => {
  const strengthColor = strength >= 70 ? 'text-tertiary' : strength >= 40 ? 'text-amber-400' : 'text-red-400';
  const barColor = strength >= 70 ? 'bg-tertiary' : strength >= 40 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-5 right-5 z-[460] pointer-events-none"
    >
      <div style={glassPanel} className="rounded-xl px-4 py-3 min-w-[150px] space-y-2">
        <motion.div
          initial={{ x: 15, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="text-[9px] font-mono tracking-[0.2em] text-on-surface-variant uppercase"
        >
          Hand Strength
        </motion.div>
        <motion.div
          initial={{ x: 15, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="text-sm font-mono font-bold text-on-surface uppercase tracking-wider"
        >
          {bestHand}
        </motion.div>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.5, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent origin-right"
        />
        <motion.div
          initial={{ x: 15, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-1"
        >
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-mono font-bold tabular-nums ${strengthColor}`}>{strength}</span>
            <span className="text-xs font-mono text-on-surface-variant">/ 100</span>
          </div>
          <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${barColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${strength}%` }}
              transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </motion.div>
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
  const strengthColor = strength >= 70 ? 'text-tertiary' : strength >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-0 left-0 right-0 z-30 pointer-events-none"
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 mx-2 mt-1 rounded-b-xl"
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
          <div className="text-[7px] font-mono tracking-[0.15em] text-on-surface-variant uppercase">Win%</div>
          <div className="text-xs font-mono font-bold text-tertiary tabular-nums">{winProb}%</div>
        </motion.div>
        <div className="h-4 w-px bg-white/10" />
        <motion.div
          className="text-center"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-[7px] font-mono tracking-[0.15em] text-on-surface-variant uppercase">Odds</div>
          <div className="text-xs font-mono font-bold text-on-surface tabular-nums">{potOdds}:1</div>
        </motion.div>
        <div className="h-4 w-px bg-white/10" />
        <motion.div
          className="text-center"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-[7px] font-mono tracking-[0.15em] text-on-surface-variant uppercase">Hand</div>
          <div className="text-[9px] font-mono font-bold text-on-surface uppercase">{bestHand}</div>
        </motion.div>
        <div className="h-4 w-px bg-white/10" />
        <motion.div
          className="text-center"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-[7px] font-mono tracking-[0.15em] text-on-surface-variant uppercase">Str</div>
          <div className={`text-xs font-mono font-bold tabular-nums ${strengthColor}`}>{strength}</div>
        </motion.div>
      </div>
    </motion.div>
  );
};
