import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Check } from 'lucide-react';
import { TimerBar } from './TimerBar';
import { cn } from '@/lib/utils';
import { useFeedback } from '@stackbluff/shared/hooks/useFeedback';

interface RaiseSliderProps {
  min: number;
  max: number;
  step: number;
  pot: number;
  bigBlind?: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
  isOpen: boolean;
  timerRemainingMs?: number | null;
  timerTotalMs?: number | null;
}

type PresetMode = 'bb' | 'pot';

export const RaiseSlider = ({
  min,
  max,
  step,
  pot,
  bigBlind = 1,
  onConfirm,
  onCancel,
  isOpen,
  timerRemainingMs,
  timerTotalMs,
}: RaiseSliderProps) => {
  const [amount, setAmount] = useState(min);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [inputValue, setInputValue] = useState(String(min));
  const [presetMode, setPresetMode] = useState<PresetMode>('bb');
  const { trigger } = useFeedback();

  const lastTickRef = useRef(0);
  const sliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount(min);
      setInputValue(String(min));
      setIsEditingAmount(false);
    }
  }, [isOpen, min]);

  const handleAmountChange = useCallback((value: number) => {
    const clamped = Math.min(Math.max(value, min), max);
    setAmount(clamped);
    setInputValue(String(clamped));
  }, [min, max]);

  const triggerTick = useCallback(() => {
    const now = Date.now();
    if (now - lastTickRef.current > 80) {
      trigger('sliderTick');
      lastTickRef.current = now;
    }
  }, [trigger]);

  const increment = useCallback((byStep: number) => {
    handleAmountChange(amount + byStep);
    triggerTick();
  }, [amount, handleAmountChange, triggerTick]);

  const decrement = useCallback((byStep: number) => {
    handleAmountChange(amount - byStep);
    triggerTick();
  }, [amount, handleAmountChange, triggerTick]);

  // Liste fixe de 10 presets pour garantir 2 lignes de 5 boutons
  const presets = useMemo(() => {
    const configs = presetMode === 'bb'
      ? [
        { label: 'Min', value: min, isSpecial: true },
        { label: '2BB', value: bigBlind * 2 },
        { label: '2.5BB', value: bigBlind * 2.5 },
        { label: '3BB', value: bigBlind * 3 },
        { label: '4BB', value: bigBlind * 4 },
        { label: '5BB', value: bigBlind * 5 },
        { label: '10BB', value: bigBlind * 10 },
        { label: '15BB', value: bigBlind * 15 },
        { label: '20BB', value: bigBlind * 20 },
        { label: 'All', value: max, isSpecial: true },
      ]
      : [
        { label: '10%', value: pot * 0.10 },
        { label: '25%', value: pot * 0.25 },
        { label: '33%', value: pot * (1 / 3) },
        { label: '50%', value: pot * 0.50 },
        { label: '75%', value: pot * 0.75 },
        { label: '100%', value: pot * 1.00 },
        { label: '150%', value: pot * 1.50 },
        { label: '200%', value: pot * 2.00 },
        { label: '300%', value: pot * 3.00 },
        { label: 'All', value: max, isSpecial: true },
      ];

    // On ne filtre plus, on désactive juste les boutons illégaux pour garder la grille fixe
    return configs.map(p => {
      const val = Math.round(p.value / step) * step;
      const isDisabled = !p.isSpecial && (val < min || val > max);
      return {
        ...p,
        value: p.isSpecial ? p.value : val,
        isDisabled
      };
    });
  }, [min, max, step, pot, bigBlind, presetMode]);

  const progress = max > min ? ((amount - min) / (max - min)) * 100 : 0;
  const potRatio = pot > 0 ? (amount / pot) * 100 : 0;

  const variants = {
    hidden: {
      opacity: 0,
      y: -15,
      maxHeight: 0,
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
    visible: {
      opacity: 1,
      y: 0,
      maxHeight: 700,
      transition: {
        type: 'spring' as const,
        damping: 30,
        stiffness: 350,
        duration: 0.3,
      },
    },
    exit: {
      opacity: 0,
      y: -15,
      maxHeight: 0,
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
  };

  const commitManualInput = () => {
    const parsed = parseInt(inputValue.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed)) {
      handleAmountChange(parsed);
    } else {
      setInputValue(String(amount));
    }
    setIsEditingAmount(false);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (isEditingAmount) return;
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    const stepAmount = e.shiftKey ? bigBlind : step;
    handleAmountChange(amount + (direction * stepAmount));
    triggerTick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditingAmount) {
      if (e.key === 'Enter') commitManualInput();
      if (e.key === 'Escape') setIsEditingAmount(false);
      return;
    }

    if (e.key === 'ArrowUp') { e.preventDefault(); increment(bigBlind); }
    if (e.key === 'ArrowDown') { e.preventDefault(); decrement(bigBlind); }
    if (e.key === 'Enter') onConfirm(amount);
    if (e.key === 'Escape') onCancel();
  };

  const formattedAmount = amount.toLocaleString('en-US');

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="raise-panel"
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="overflow-hidden bg-[rgba(8,8,8,0.95)] backdrop-blur-md px-5 pt-4 pb-5 border-b border-white/5"
        >
          {timerRemainingMs !== null && timerRemainingMs !== undefined && (
            <div className="w-full px-0.5 mb-3">
              <TimerBar
                remainingMs={timerRemainingMs}
                totalMs={timerTotalMs ?? null}
                isActive={true}
              />
            </div>
          )}

          <div
            className="space-y-4 outline-none"
            onWheel={onWheel}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            {/* Header, Toggle & Close */}
            <div className="flex items-center justify-between pt-1">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center gap-3"
              >
                <span className="font-label-caps text-[10px] text-tertiary tracking-widest uppercase">
                  Raise Amount
                </span>

                {/* Segmented Control (Switch) */}
                <div className="flex gap-1 bg-white/5 p-1 rounded-[6px] border border-white/5">
                  <motion.button
                    type="button"
                    onClick={() => setPresetMode('bb')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'px-2.5 py-1 rounded-[4px] text-[8px] font-label-caps uppercase tracking-wider transition-all',
                      presetMode === 'bb' ? 'bg-tertiary/20 text-tertiary shadow-sm' : 'text-on-surface-variant/60 hover:text-on-surface-variant'
                    )}
                  >
                    BB
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setPresetMode('pot')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'px-2.5 py-1 rounded-[4px] text-[8px] font-label-caps uppercase tracking-wider transition-all',
                      presetMode === 'pot' ? 'bg-tertiary/20 text-tertiary shadow-sm' : 'text-on-surface-variant/60 hover:text-on-surface-variant'
                    )}
                  >
                    Pot %
                  </motion.button>
                </div>
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => { onCancel(); trigger('buttonClick'); }}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Display & Adjusters */}
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() => decrement(bigBlind)}
                className="w-8 h-8 rounded-lg border border-outline-variant/20 flex items-center justify-center hover:bg-white/5 text-on-surface-variant transition-colors"
              >
                <Minus className="w-4 h-4" />
              </motion.button>

              <div className="flex-1 text-center cursor-text" onClick={() => !isEditingAmount && setIsEditingAmount(true)}>
                <AnimatePresence mode="popLayout">
                  {isEditingAmount ? (
                    <motion.input
                      key="input"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onBlur={commitManualInput}
                      autoFocus
                      className="w-full bg-transparent text-center font-data-mono text-2xl text-tertiary font-bold tabular-nums outline-none border-b-2 border-tertiary/50 focus:border-tertiary"
                    />
                  ) : (
                    <motion.div
                      key="display"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center"
                    >
                      <span className="font-data-mono text-2xl text-tertiary font-bold tabular-nums">
                        ${formattedAmount}
                      </span>
                      {pot > 0 && (
                        <span className="text-[9px] font-mono text-on-surface-variant/70 uppercase tracking-wider">
                          {potRatio.toFixed(0)}% Pot
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() => increment(bigBlind)}
                className="w-8 h-8 rounded-lg border border-outline-variant/20 flex items-center justify-center hover:bg-white/5 text-on-surface-variant transition-colors"
              >
                <Plus className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Custom Track */}
            <div className="relative w-full py-2">
              <input
                ref={sliderRef}
                type="range"
                min={min}
                max={max}
                step={step}
                value={amount}
                onChange={(e) => {
                  handleAmountChange(Number(e.target.value));
                  triggerTick();
                }}
                className="relative w-full h-6 cursor-pointer appearance-none bg-transparent z-10 raise-slider-input"
                style={
                  {
                    '--progress': `${progress}%`,
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  } as React.CSSProperties
                }
              />
              <style>{`
                .raise-slider-input { background: transparent; }
                .raise-slider-input::-webkit-slider-runnable-track {
                  height: 6px;
                  border-radius: 9999px;
                  background: linear-gradient(to right, #4edea3 0%, #4edea3 var(--progress), rgba(255,255,255,0.1) var(--progress), rgba(255,255,255,0.1) 100%);
                }
                .raise-slider-input::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: radial-gradient(circle at 35% 35%, #ffffff, #8b8b8b 60%, #1a1a1a);
                  border: 2px solid rgba(255,255,255,0.2);
                  box-shadow: 0 4px 12px rgba(0,0,0,0.8), 0 0 0 0px rgba(78,222,163,0.0);
                  cursor: grab;
                  transition: box-shadow 0.2s, transform 0.2s;
                  margin-top: -7px;
                }
                .raise-slider-input:hover::-webkit-slider-thumb,
                .raise-slider-input:active::-webkit-slider-thumb {
                  transform: scale(1.15);
                  box-shadow: 0 6px 16px rgba(0,0,0,0.9), 0 0 0 6px rgba(78,222,163,0.2);
                  cursor: grabbing;
                }
                .raise-slider-input::-moz-range-track {
                  height: 6px;
                  border-radius: 9999px;
                  background: rgba(255,255,255,0.1);
                }
                .raise-slider-input::-moz-range-progress {
                  height: 6px;
                  border-radius: 9999px;
                  background-color: #4edea3;
                }
                .raise-slider-input::-moz-range-thumb {
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: radial-gradient(circle at 35% 35%, #ffffff, #8b8b8b 60%, #1a1a1a);
                  border: 2px solid rgba(255,255,255,0.2);
                  box-shadow: 0 4px 12px rgba(0,0,0,0.8);
                  cursor: grab;
                }
              `}</style>
            </div>

            {/* Presets Grid - Strict 5 columns to force 2 rows of 5 */}
            <div className="px-1 py-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={presetMode}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="grid grid-cols-5 gap-1.5"
                >
                  {presets.map((preset, idx) => (
                    <motion.button
                      key={`${preset.label}-${idx}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1, transition: { delay: idx * 0.02 } }}
                      whileHover={!preset.isDisabled ? { scale: 1.05, y: -1 } : {}}
                      whileTap={!preset.isDisabled ? { scale: 0.93 } : {}}
                      type="button"
                      disabled={preset.isDisabled}
                      onClick={() => {
                        handleAmountChange(preset.value);
                        trigger('sliderConfirm');
                      }}
                      className={cn(
                        'w-full py-1.5 rounded-md text-[9px] font-label-caps uppercase tracking-wider transition-colors',
                        preset.isDisabled
                          ? 'bg-white/[0.02] text-white/15 cursor-not-allowed border border-white/5'
                          : amount === preset.value
                            ? 'bg-tertiary text-on-tertiary shadow-[0_0_15px_rgba(78,222,163,0.2)]'
                            : 'bg-white/5 text-on-surface-variant hover:bg-white/10 border border-white/5'
                      )}
                    >
                      {preset.label}
                    </motion.button>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Confirm Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <motion.button
                type="button"
                onClick={() => {
                  onConfirm(amount);
                  const intensityScale = max > min ? amount / max : 0.5;
                  trigger('raise', { volume: 0.5 + intensityScale * 0.5 });
                }}
                className="w-full py-2.5 rounded-md bg-tertiary text-on-tertiary font-label-caps text-[11px] uppercase tracking-wider hover:bg-tertiary/80 transition-all shadow-[0_0_20px_rgba(78,222,163,0.15)] flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(78,222,163,0.25)' }}
                whileTap={{ scale: 0.95 }}
              >
                <Check className="w-3.5 h-3.5" />
                Confirm Raise
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
