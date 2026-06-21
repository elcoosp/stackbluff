import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Vibrate,
  VibrateOff,
  MapPin,
  Zap,
  RotateCcw,
  ChevronDown,
  Play,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useFeedback } from '../../hooks/useFeedback';
import type { FeedbackEvent } from '../../services/feedback/types';

/* ── Toggle Switch ── */
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        checked ? 'bg-tertiary' : 'bg-white/10',
        disabled && 'opacity-30 cursor-not-allowed',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5 bg-white' : 'translate-x-0 bg-white/50',
        )}
      />
    </button>
  );
}

/* ── Slider with label ── */
function FeedbackSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  formatValue,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <span className="text-[11px] font-mono text-tertiary tabular-nums">
          {formatValue ? formatValue(value) : Math.round(value * 100)}%
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="feedback-settings-slider w-full"
          style={{ '--pct': `${pct}%` } as React.CSSProperties}
        />
        <style>{`
          .feedback-settings-slider {
            -webkit-appearance: none;
            appearance: none;
            height: 6px;
            border-radius: 9999px;
            background: linear-gradient(
              to right,
              #4edea3 0%,
              #4edea3 var(--pct),
              rgba(255,255,255,0.08) var(--pct),
              rgba(255,255,255,0.08) 100%
            );
            outline: none;
            cursor: pointer;
          }
          .feedback-settings-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: radial-gradient(circle at center, #000 3px, #fff 3px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            cursor: pointer;
          }
          .feedback-settings-slider::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: radial-gradient(circle at center, #000 3px, #fff 3px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            cursor: pointer;
            border: none;
          }
        `}</style>
      </div>
    </div>
  );
}

/* ── Test Button ── */
function TestButton({ event, label }: { event: FeedbackEvent; label: string }) {
  const { trigger } = useFeedback();
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => trigger(event)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/5 text-[10px] uppercase tracking-wider text-on-surface-variant hover:bg-white/10 hover:border-white/10 transition-all"
    >
      <Play className="w-3 h-3 text-tertiary" />
      {label}
    </motion.button>
  );
}

/* ── Main Settings Component ── */
export function FeedbackSettings() {
  const store = useFeedbackStore();
  const [showTests, setShowTests] = useState(false);

  const { isHapticSupported } = useFeedback();

  return (
    <div className="space-y-5">
      {/* ── Master Toggle ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Haptic & Audio Feedback</h3>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            Multi-sensory feedback for game actions
          </p>
        </div>
        <Toggle checked={store.masterEnabled} onChange={store.setMasterEnabled} />
      </div>

      <AnimatePresence>
        {store.masterEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-5 pt-1">
              {/* Divider */}
              <div className="h-px bg-white/5" />

              {/* ── Haptics Section ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {store.hapticsEnabled ? (
                      <Vibrate className="w-4 h-4 text-tertiary" />
                    ) : (
                      <VibrateOff className="w-4 h-4 text-on-surface-variant/40" />
                    )}
                    <span className="text-[12px] font-medium text-on-surface">Vibration</span>
                  </div>
                  <Toggle
                    checked={store.hapticsEnabled}
                    onChange={store.setHapticsEnabled}
                    disabled={!isHapticSupported}
                  />
                </div>
                {!isHapticSupported && (
                  <p className="text-[10px] text-on-surface-variant/50 italic pl-6">
                    Not supported on this device
                  </p>
                )}
                {store.hapticsEnabled && (
                  <div className="pl-6">
                    <FeedbackSlider
                      label="Intensity"
                      value={store.hapticIntensity}
                      onChange={store.setHapticIntensity}
                    />
                  </div>
                )}
              </div>

              {/* ── Audio Section ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {store.audioEnabled ? (
                      <Volume2 className="w-4 h-4 text-tertiary" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-on-surface-variant/40" />
                    )}
                    <span className="text-[12px] font-medium text-on-surface">Sound Effects</span>
                  </div>
                  <Toggle checked={store.audioEnabled} onChange={store.setAudioEnabled} />
                </div>
                {store.audioEnabled && (
                  <div className="pl-6 space-y-3">
                    <FeedbackSlider
                      label="Volume"
                      value={store.audioVolume}
                      onChange={store.setAudioVolume}
                    />
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-white/5" />

              {/* ── Advanced ── */}
              <div className="space-y-3">
                <span className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant/50">
                  Advanced
                </span>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-on-surface-variant/60" />
                    <span className="text-[12px] text-on-surface-variant">Spatial Audio</span>
                  </div>
                  <Toggle
                    checked={store.spatialAudio}
                    onChange={store.setSpatialAudio}
                    disabled={!store.audioEnabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-on-surface-variant/60" />
                    <span className="text-[12px] text-on-surface-variant">Adaptive Intensity</span>
                  </div>
                  <Toggle checked={store.adaptiveFeedback} onChange={store.setAdaptiveFeedback} />
                </div>

                <p className="text-[10px] text-on-surface-variant/40 pl-5">
                  Automatically increases feedback at higher stakes
                </p>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/5" />

              {/* ── Test Sounds ── */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowTests(!showTests)}
                  className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-on-surface-variant hover:text-tertiary transition-colors"
                >
                  <motion.span
                    animate={{ rotate: showTests ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </motion.span>
                  Test Feedback
                </button>

                <AnimatePresence>
                  {showTests && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-3">
                        <TestButton event="cardDeal" label="Card Deal" />
                        <TestButton event="cardFlip" label="Card Flip" />
                        <TestButton event="chipClink" label="Chip Clink" />
                        <TestButton event="bet" label="Bet" />
                        <TestButton event="raise" label="Raise" />
                        <TestButton event="check" label="Check" />
                        <TestButton event="call" label="Call" />
                        <TestButton event="fold" label="Fold" />
                        <TestButton event="allIn" label="All In" />
                        <TestButton event="win" label="Win" />
                        <TestButton event="lose" label="Lose" />
                        <TestButton event="timerUrgent" label="Timer" />
                        <TestButton event="potCollect" label="Pot Collect" />
                        <TestButton event="roundStart" label="New Round" />
                        <TestButton event="error" label="Error" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Reset ── */}
              <button
                type="button"
                onClick={store.resetToDefaults}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Defaults
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
