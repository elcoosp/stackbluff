import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimerBar } from './TimerBar';
import { cn } from '@/lib/utils';
import { useFeedback } from '@stackbluff/shared/hooks/useFeedback';

interface RaiseSliderProps {
  min: number;
  max: number;
  step: number;
  pot: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
  isOpen: boolean;
  timerRemainingMs?: number | null;
  timerTotalMs?: number | null;
}

export const RaiseSlider = ({
  min,
  max,
  step,
  pot,
  onConfirm,
  onCancel,
  isOpen,
  timerRemainingMs,
  timerTotalMs,
}: RaiseSliderProps) => {
  const [amount, setAmount] = useState(min);
  const { trigger } = useFeedback();
  const lastSliderTickRef = useRef(0);

  useEffect(() => {
    if (isOpen) setAmount(min);
  }, [isOpen, min]);

  const handleAmountChange = useCallback((value: number) => {
    const clamped = Math.min(Math.max(value, min), max);
    setAmount(clamped);
  }, [min, max]);

  const increment = () => {
    handleAmountChange(amount + step);
    trigger('sliderTick');
  };

  const decrement = () => {
    handleAmountChange(amount - step);
    trigger('sliderTick');
  };

  // Clamp presets so they never fall below the min raise amount
  const presets = [
    { label: '½ POT', value: Math.max(min, Math.floor(pot * 0.5)) },
    { label: '¾ POT', value: Math.max(min, Math.floor(pot * 0.75)) },
    { label: 'POT', value: Math.max(min, pot) },
    { label: 'MAX', value: max },
  ];

  const progress = max > min ? ((amount - min) / (max - min)) * 100 : 0;

  // ── Animation variants ──
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
      maxHeight: 500,
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

  const numberVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: {
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        damping: 20,
        stiffness: 400,
      },
    },
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="raise-panel"
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="overflow-hidden bg-[rgba(8,8,8,0.95)] backdrop-blur-md px-5 pt-4 pb-3 border-b border-white/5"
        >
          {/* Hero Timer Bar */}
          {timerRemainingMs !== null && timerRemainingMs !== undefined && (
            <div className="w-full px-0.5 mb-3">
              <TimerBar
                remainingMs={timerRemainingMs}
                totalMs={timerTotalMs ?? null}
                isActive={true}
              />
            </div>
          )}

          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="font-label-caps text-[10px] text-tertiary tracking-widest uppercase"
              >
                RAISE AMOUNT
              </motion.span>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => {
                  onCancel();
                  trigger('buttonClick');
                }}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Amount with +/- buttons */}
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={decrement}
                disabled={amount <= min}
                className="w-8 h-8 rounded-lg border border-outline-variant/20 flex items-center justify-center hover:bg-white/5 text-on-surface-variant transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Minus className="w-4 h-4" />
              </motion.button>

              <div className="flex-1 text-center">
                <motion.span
                  key={amount}
                  variants={numberVariants}
                  initial="initial"
                  animate="animate"
                  className="font-data-mono text-2xl text-tertiary font-bold tabular-nums"
                >
                  ${amount.toLocaleString()}
                </motion.span>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={increment}
                disabled={amount >= max}
                className="w-8 h-8 rounded-lg border border-outline-variant/20 flex items-center justify-center hover:bg-white/5 text-on-surface-variant transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Slider */}
            <div className="relative w-full py-2">
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={amount}
                onChange={(e) => {
                  handleAmountChange(Number(e.target.value));
                  // Throttled tick via useFeedback's built-in throttle
                  trigger('sliderTick');
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
                .raise-slider-input {
                  background: transparent;
                }
                /* Webkit (Chrome, Safari, Edge) */
                .raise-slider-input::-webkit-slider-runnable-track {
                  height: 6px;
                  border-radius: 9999px;
                  background: linear-gradient(to right, #4edea3 0%, #4edea3 var(--progress), rgba(255,255,255,0.1) var(--progress), rgba(255,255,255,0.1) 100%);
                }
                .raise-slider-input::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 22px;
                  height: 22px;
                  border-radius: 50%;
                  background: radial-gradient(circle at center, #000 4px, #fff 4px);
                  box-shadow: 0 2px 10px rgba(0,0,0,0.6);
                  cursor: pointer;
                  border: none;
                  margin-top: -8px; /* (22px thumb - 6px track) / 2 */
                }

                /* Firefox */
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

            {/* Preset buttons */}
            <div className="flex gap-1.5">
              {presets.map((preset, idx) => (
                <motion.button
                  key={preset.label}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + idx * 0.03 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => {
                    handleAmountChange(preset.value);
                    trigger('sliderConfirm');
                  }}
                  className={cn(
                    'flex-1 py-1.5 rounded-md text-[9px] font-label-caps uppercase tracking-wider transition-all',
                    amount === preset.value
                      ? 'bg-tertiary text-on-tertiary shadow-[0_0_15px_rgba(78,222,163,0.2)]'
                      : 'bg-white/5 text-on-surface-variant hover:bg-white/10 border border-white/5'
                  )}
                >
                  {preset.label}
                </motion.button>
              ))}
            </div>

            {/* Confirm button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Button
                type="button"
                onClick={() => {
                  onConfirm(amount);
                  // Intensity scales with raise size — bigger raise = louder haptic
                  const intensityScale = max > min ? amount / max : 0.5;
                  trigger('raise', { volume: 0.5 + intensityScale * 0.5 });
                }}
                className="w-full py-2 rounded-md bg-tertiary text-on-tertiary font-label-caps text-[10px] uppercase tracking-wider hover:bg-tertiary/80 transition-all shadow-[0_0_20px_rgba(78,222,163,0.15)]"
              >
                Confirm Raise
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
