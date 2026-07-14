import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface BuyInDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  minBuyIn: number;
  maxBuyIn: number;
  defaultBuyIn: number;
  tableName?: string;
  stakeLevel?: string;
  currentBalance: number;
  isRebuy?: boolean;
  isTournament?: boolean;
}

const STAKE_CONFIG: Record<string, string> = {
  Micro: '$0.02/$0.05',
  Low: '$0.10/$0.25',
  Medium: '$0.50/$1.00',
  High: '$2/$4',
  VeryHigh: '$5/$10',
};

export function BuyInDialog({
  open,
  onClose,
  onConfirm,
  minBuyIn,
  maxBuyIn,
  defaultBuyIn,
  tableName,
  stakeLevel,
  currentBalance,
  isRebuy = false,
  isTournament = false,
}: BuyInDialogProps) {
  const [amount, setAmount] = useState(defaultBuyIn);
  const [customInput, setCustomInput] = useState(false);
  const [inputValue, setInputValue] = useState(String(defaultBuyIn));

  const effectiveMax = Math.min(maxBuyIn, currentBalance);
  const canAfford = currentBalance >= minBuyIn;
  const isValid = amount >= minBuyIn && amount <= effectiveMax;

  const presets = [
    { label: t`MIN`, value: minBuyIn },
    { label: t`50%`, value: Math.max(minBuyIn, Math.floor(effectiveMax * 0.5)) },
    { label: t`75%`, value: Math.max(minBuyIn, Math.floor(effectiveMax * 0.75)) },
    { label: t`MAX`, value: effectiveMax },
  ];

  // Deduplicate presets
  const uniquePresets = presets.reduce((acc, p) => {
    if (!acc.some((x) => x.value === p.value)) acc.push(p);
    return acc;
  }, [] as typeof presets);

  const handleConfirm = () => {
    if (isValid) onConfirm(amount);
  };

  const progress = effectiveMax > minBuyIn
    ? ((amount - minBuyIn) / (effectiveMax - minBuyIn)) * 100
    : 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="buyin-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[800] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            key="buyin-dialog"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400, duration: 0.3 }}
            className="fixed z-[810] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm rounded-xl bg-[rgba(12,12,12,0.97)] border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
              <div>
                <h2 className="text-sm font-semibold text-on-surface">{isRebuy ? t`Rebuy` : t`Buy In`}</h2>
                {isTournament && (
                  <p className="text-xs text-yellow-400 mt-1">
                    <Trans>⚠️ Tournament mode: no rebuys allowed</Trans>
                  </p>
                )}
                {tableName && (
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {tableName} • {STAKE_CONFIG[stakeLevel || ''] || stakeLevel}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-5">
              {/* Balance */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                  <Trans>Available Balance</Trans>
                </span>
                <span
                  className={cn(
                    'font-mono text-sm font-bold',
                    canAfford ? 'text-tertiary' : 'text-red-400',
                  )}
                >
                  ${currentBalance.toLocaleString()}
                </span>
              </div>

              {!canAfford && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
                  <Trans>Insufficient balance. Minimum buy-in is ${minBuyIn.toLocaleString()}.</Trans>
                </div>
              )}

              {/* Amount display */}
              <div className="flex items-center justify-center gap-3">
                <motion.button
                  whileHover={amount <= minBuyIn ? undefined : { scale: 1.08 }}
                  whileTap={amount <= minBuyIn ? undefined : { scale: 0.92 }}
                  type="button"
                  onClick={() => {
                    const newAmt = Math.max(minBuyIn, amount - (stakeLevel === 'Micro' ? 5 : stakeLevel === 'Low' ? 25 : 100));
                    setAmount(newAmt);
                    setInputValue(String(newAmt));
                  }}
                  disabled={amount <= minBuyIn}
                  className="w-9 h-9 rounded-lg border border-outline-variant/20 flex items-center justify-center hover:bg-white/5 text-on-surface-variant transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <Minus className="w-4 h-4" />
                </motion.button>

                <motion.div
                  className="text-center min-w-[120px]"
                  onClick={() => setCustomInput(true)}
                >
                  {customInput ? (
                    <input
                      type="number"
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        const n = parseInt(e.target.value, 10);
                        if (!isNaN(n)) setAmount(n);
                      }}
                      onBlur={() => {
                        setCustomInput(false);
                        const clamped = Math.min(Math.max(amount, minBuyIn), effectiveMax);
                        setAmount(clamped);
                        setInputValue(String(clamped));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      autoFocus
                      className="w-full text-center bg-transparent text-3xl font-mono font-bold text-tertiary outline-none border-none tabular-nums"
                    />
                  ) : (
                    <span className="text-3xl font-mono font-bold text-tertiary tabular-nums">
                      ${amount.toLocaleString()}
                    </span>
                  )}
                </motion.div>

                <motion.button
                  whileHover={amount >= effectiveMax ? undefined : { scale: 1.08 }}
                  whileTap={amount >= effectiveMax ? undefined : { scale: 0.92 }}
                  type="button"
                  onClick={() => {
                    const step = stakeLevel === 'Micro' ? 5 : stakeLevel === 'Low' ? 25 : 100;
                    const newAmt = Math.min(effectiveMax, amount + step);
                    setAmount(newAmt);
                    setInputValue(String(newAmt));
                  }}
                  disabled={amount >= effectiveMax}
                  className="w-9 h-9 rounded-lg border border-outline-variant/20 flex items-center justify-center hover:bg-white/5 text-on-surface-variant transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <Plus className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Slider */}
              <div className="relative w-full py-1">
                <input
                  type="range"
                  min={minBuyIn}
                  max={effectiveMax}
                  step={stakeLevel === 'Micro' ? 5 : stakeLevel === 'Low' ? 25 : 100}
                  value={amount}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setAmount(n);
                    setInputValue(String(n));
                  }}
                  className="relative w-full h-6 cursor-pointer appearance-none bg-transparent z-10 buyin-slider-input"
                  style={
                    {
                      '--progress': `${progress}%`,
                      WebkitAppearance: 'none',
                      appearance: 'none',
                    } as React.CSSProperties
                  }
                />
                <style>{`
                  .buyin-slider-input {
                    background: transparent;
                  }
                  .buyin-slider-input::-webkit-slider-runnable-track {
                    height: 6px;
                    border-radius: 9999px;
                    background: linear-gradient(to right, #4edea3 0%, #4edea3 var(--progress), rgba(255,255,255,0.1) var(--progress), rgba(255,255,255,0.1) 100%);
                  }
                  .buyin-slider-input::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: radial-gradient(circle at center, #000 4px, #fff 4px);
                    box-shadow: 0 2px 10px rgba(0,0,0,0.6);
                    cursor: pointer;
                    border: none;
                    margin-top: -8px;
                  }
                  .buyin-slider-input::-moz-range-track {
                    height: 6px;
                    border-radius: 9999px;
                    background: rgba(255,255,255,0.1);
                  }
                  .buyin-slider-input::-moz-range-progress {
                    height: 6px;
                    border-radius: 9999px;
                    background-color: #4edea3;
                  }
                  .buyin-slider-input::-moz-range-thumb {
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: radial-gradient(circle at center, #000 4px, #fff 4px);
                    box-shadow: 0 2px 10px rgba(0,0,0,0.6);
                    cursor: pointer;
                    border: none;
                  }
                `}</style>
              </div>

              {/* Presets */}
              <div className="flex gap-1.5">
                {uniquePresets.map((preset, idx) => (
                  <motion.button
                    key={preset.label}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + idx * 0.03 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.93 }}
                    type="button"
                    onClick={() => {
                      setAmount(preset.value);
                      setInputValue(String(preset.value));
                    }}
                    className={cn(
                      'flex-1 py-1.5 rounded-md text-[9px] font-label-caps uppercase tracking-wider transition-all',
                      amount === preset.value
                        ? 'bg-tertiary text-on-tertiary shadow-[0_0_15px_rgba(78,222,163,0.2)]'
                        : 'bg-white/5 text-on-surface-variant hover:bg-white/10 border border-white/5',
                    )}
                  >
                    {preset.label}
                  </motion.button>
                ))}
              </div>

              {/* Min/Max labels */}
              <div className="flex justify-between text-[10px] text-on-surface-variant font-mono">
                <span><Trans>MIN ${minBuyIn.toLocaleString()}</Trans></span>
                <span><Trans>MAX ${effectiveMax.toLocaleString()}</Trans></span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/5 flex gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-on-surface-variant text-[11px] font-label-caps uppercase tracking-wider hover:bg-white/5 transition-all"
              >
                <Trans>Cancel</Trans>
              </motion.button>
              <motion.button
                type="button"
                whileHover={isValid ? { scale: 1.02, boxShadow: '0 0 30px rgba(78,222,163,0.25)' } : undefined}
                whileTap={isValid ? { scale: 0.95 } : undefined}
                onClick={handleConfirm}
                disabled={!isValid}
                className={cn(
                  'flex-1 py-2.5 rounded-lg font-label-caps text-[11px] uppercase tracking-wider transition-all',
                  isValid
                    ? 'bg-tertiary text-on-tertiary shadow-[0_0_20px_rgba(78,222,163,0.15)]'
                    : 'bg-white/5 text-on-surface-variant/30 cursor-not-allowed',
                )}
              >
                <Wallet className="w-3.5 h-3.5 inline mr-1.5" />
                {isRebuy ? t`Rebuy` : t`Take Seat`}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
