/**
 * ActionBar — native port of PWA `components/game/ActionBar.tsx` (32KB).
 *
 * Desktop + Mobile variants with the exact glass material
 * (rgba(8,8,8,0.85), white/8 border, 0 12px 48px shadow), 2s breathing
 * emerald border while acting, execution banner for queued pre-actions,
 * full pre-action panel (fold / check-or-fold / call-up-to input), the
 * raise panel (min/max + BB & Pot-% presets quantized to the big blind —
 * exact PWA logic — minus/plus adjusters, pot-ratio readout, ui-native
 * RaiseSlider track, confirm button with scaled feedback volume), random
 * sparkle sweeps while idle, and the disabled/disabled-color system per
 * variant. Keyboard shortcuts are desktop-only in the PWA and are skipped
 * on touch (recorded in the worklog).
 */

import { RaiseSlider } from '@stackbluff/ui-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { formatCurrency } from './format';
import {
  BotIcon,
  CheckIcon,
  DollarSignIcon,
  LogOutIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  SwordsIcon,
  TrendingUpIcon,
  XIcon,
  ZapIcon,
} from './icons';
import type { PreAction } from './usePreAction';

/* ── Shared hooks ────────────────────────────────────────────────────────── */

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
      const timer = setTimeout(() => setVisible(null), delay);
      return () => clearTimeout(timer);
    }
  }, [visible, delay]);

  return visible;
}

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
      timeout1 = setTimeout(
        () => {
          setSparkIndex(Math.floor(Math.random() * 4));
          timeout2 = setTimeout(() => {
            setSparkIndex(null);
            run();
          }, 800);
        },
        2000 + Math.random() * 3000,
      );
    };
    run();
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [enabled]);

  return sparkIndex;
}

/* ── Variant config (exact PWA values) ───────────────────────────────────── */
interface VariantCfg {
  activeBg: string;
  activeBorder: string;
  activeText: string;
  activeGlowOpacity: number;
  hoverBg: string;
  hoverBorder: string;
  disabledBg: string;
  disabledBorder: string;
  disabledText: string;
  Icon: typeof LogOutIcon;
}

const variantConfig: Record<string, VariantCfg> = {
  fold: {
    activeBg: 'rgba(239,68,68,0.06)',
    activeBorder: 'rgba(239,68,68,0.25)',
    activeText: '#f87171',
    activeGlowOpacity: 0.1,
    hoverBg: 'rgba(239,68,68,0.1)',
    hoverBorder: 'rgba(239,68,68,0.35)',
    disabledBg: 'rgba(239,68,68,0.02)',
    disabledBorder: 'rgba(239,68,68,0.08)',
    disabledText: 'rgba(248,113,113,0.22)',
    Icon: LogOutIcon,
  },
  call: {
    activeBg: 'rgba(78,222,163,0.06)',
    activeBorder: 'rgba(78,222,163,0.25)',
    activeText: '#4edea3',
    activeGlowOpacity: 0.1,
    hoverBg: 'rgba(78,222,163,0.1)',
    hoverBorder: 'rgba(78,222,163,0.35)',
    disabledBg: 'rgba(78,222,163,0.02)',
    disabledBorder: 'rgba(78,222,163,0.08)',
    disabledText: 'rgba(78,222,163,0.22)',
    Icon: DollarSignIcon,
  },
  raise: {
    activeBg: 'rgba(255,255,255,0.04)',
    activeBorder: 'rgba(255,255,255,0.15)',
    activeText: 'rgba(255,255,255,0.85)',
    activeGlowOpacity: 0.04,
    hoverBg: 'rgba(255,255,255,0.07)',
    hoverBorder: 'rgba(255,255,255,0.22)',
    disabledBg: 'rgba(255,255,255,0.02)',
    disabledBorder: 'rgba(255,255,255,0.06)',
    disabledText: 'rgba(255,255,255,0.15)',
    Icon: TrendingUpIcon,
  },
  'all-in': {
    activeBg: 'rgba(245,158,11,0.06)',
    activeBorder: 'rgba(245,158,11,0.25)',
    activeText: '#fbbf24',
    activeGlowOpacity: 0.1,
    hoverBg: 'rgba(245,158,11,0.1)',
    hoverBorder: 'rgba(245,158,11,0.35)',
    disabledBg: 'rgba(245,158,11,0.02)',
    disabledBorder: 'rgba(245,158,11,0.08)',
    disabledText: 'rgba(251,191,36,0.22)',
    Icon: SwordsIcon,
  },
};

/* ── ActionBtn ───────────────────────────────────────────────────────────── */
function ActionBtn({
  variant,
  onPress,
  disabled,
  children,
  IconOverride,
  sparkId,
  currentSpark,
}: {
  variant: 'fold' | 'call' | 'raise' | 'all-in';
  onPress: () => void;
  disabled: boolean;
  children: string;
  IconOverride?: typeof CheckIcon;
  sparkId?: number;
  currentSpark?: number | null;
}) {
  const cfg = variantConfig[variant];
  const Icon = IconOverride ?? cfg.Icon;
  const isSparking = sparkId !== undefined && currentSpark === sparkId;

  const scale = useSharedValue(1);
  const sweepX = useSharedValue(-150);
  const sweepOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isSparking) return;
    sweepX.value = -150;
    sweepOpacity.value = 0;
    sweepX.value = withTiming(250, { duration: 800, easing: Easing.inOut(Easing.ease) });
    sweepOpacity.value = withSequence(
      withTiming(1, { duration: 160, easing: Easing.linear }),
      withTiming(1, { duration: 480, easing: Easing.linear }),
      withTiming(0, { duration: 160, easing: Easing.linear }),
    );
  }, [isSparking, sweepX, sweepOpacity]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${sweepX.value}%` }],
    opacity: sweepOpacity.value,
  }));

  const pressIn = useCallback(() => {
    if (!disabled) scale.value = withTiming(0.94, { duration: 100 });
  }, [disabled, scale]);
  const pressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const color = disabled ? cfg.disabledText : cfg.activeText;
  const bg = disabled ? cfg.disabledBg : cfg.activeBg;
  const border = disabled ? cfg.disabledBorder : cfg.activeBorder;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      style={{ flex: 1, minWidth: 0 }}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: border,
            backgroundColor: bg,
            overflow: 'hidden',
          },
          animStyle,
        ]}
      >
        {isSparking && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '33%',
                width: '34%',
                backgroundColor: `${cfg.activeText}40`,
                transform: [{ skewX: '-20deg' }],
              },
              sweepStyle,
            ]}
          />
        )}
        <Icon size={16} color={color} />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            color,
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {children}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/* ── Execution banner ────────────────────────────────────────────────────── */
function ExecutionBanner({
  visibleAction,
}: {
  visibleAction: { action: string; amount: number } | null;
}) {
  const [mountKey, setMountKey] = useState(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  const action = visibleAction?.action;
  const amount = visibleAction?.amount;
  const isCall = action?.toLowerCase() === 'call';
  const displayText =
    `Auto ${action ?? ''}${isCall && amount && amount > 0 ? ` $${amount}` : ''}`.trim();

  useEffect(() => {
    if (action) {
      setMountKey((k) => k + 1);
      height.value = withTiming(28, { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      height.value = withTiming(0, { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) });
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [action, height, opacity]);

  const anim = useAnimatedStyle(() => ({ height: height.value, opacity: opacity.value }));
  if (!action) return null;
  return (
    <Animated.View
      key={mountKey}
      style={[
        {
          overflow: 'hidden',
          marginHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 4,
        },
        anim,
      ]}
    >
      <ZapIcon size={12} color="#4edea3" />
      <Text
        allowFontScaling={false}
        style={{
          color: '#4edea3',
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        {displayText}
      </Text>
    </Animated.View>
  );
}

/* ── Pre-action panel ────────────────────────────────────────────────────── */
const PRE_ACTION_OPTIONS: { key: PreAction['type']; label: string; shortLabel: string }[] = [
  { key: 'fold', label: 'Fold', shortLabel: 'Fold' },
  { key: 'check_or_fold', label: 'Check / Fold', shortLabel: 'Chk/Fld' },
];

function PreActionPanel({
  preAction,
  onSetPreAction,
  toCall,
  compact,
}: {
  preAction: PreAction | null;
  onSetPreAction: (pa: PreAction | null) => void;
  toCall: number;
  compact?: boolean;
}) {
  const [callUpToValue, setCallUpToValue] = useState('100');
  const [callUpToEditing, setCallUpToEditing] = useState(false);

  const handleClick = (type: PreAction['type']) => {
    if (preAction?.type === type) onSetPreAction(null);
    else onSetPreAction({ type } as PreAction);
  };

  const optionStyle = (isSelected: boolean) => ({
    borderColor: isSelected ? '#4edea3' : 'rgba(255,255,255,0.08)',
    backgroundColor: isSelected ? 'rgba(78,222,163,0.15)' : 'rgba(255,255,255,0.03)',
    borderWidth: 1,
  });
  const optionText = (isSelected: boolean) => ({
    color: isSelected ? '#4edea3' : 'rgba(255,255,255,0.3)',
  });

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {PRE_ACTION_OPTIONS.map((opt) => {
          const isSelected = preAction?.type === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => handleClick(opt.key)}
              style={[
                {
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  paddingVertical: 8,
                  borderRadius: 8,
                },
                optionStyle(isSelected),
              ]}
            >
              {opt.key === 'fold' ? (
                <LogOutIcon size={14} color={optionText(isSelected).color} />
              ) : (
                <RotateCcwIcon size={14} color={optionText(isSelected).color} />
              )}
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  optionText(isSelected),
                  { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
                ]}
              >
                {compact ? opt.shortLabel : opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {toCall > 0 && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {callUpToEditing ? (
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(78,222,163,0.4)',
                backgroundColor: 'rgba(0,0,0,0.3)',
              }}
            >
              <Text allowFontScaling={false} style={{ color: 'rgba(78,222,163,0.5)', fontSize: 9 }}>
                Call ≤ $
              </Text>
              <TextInput
                value={callUpToValue}
                onChangeText={(t) => setCallUpToValue(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                onSubmitEditing={() => {
                  const n = Number.parseInt(callUpToValue, 10);
                  if (!Number.isNaN(n) && n > 0) onSetPreAction({ type: 'call_up_to', amount: n });
                  setCallUpToEditing(false);
                }}
                onBlur={() => setCallUpToEditing(false)}
                autoFocus
                style={{
                  flex: 1,
                  color: '#4edea3',
                  fontSize: 10,
                  padding: 0,
                  fontFamily: undefined,
                }}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => {
                if (preAction?.type === 'call_up_to') onSetPreAction(null);
                else setCallUpToEditing(true);
              }}
              style={[
                {
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 8,
                  borderRadius: 8,
                },
                optionStyle(preAction?.type === 'call_up_to'),
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  optionText(preAction?.type === 'call_up_to'),
                  { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
                ]}
              >
                {preAction?.type === 'call_up_to' ? `Call ≤ $${preAction.amount}` : 'Call ≤ $…'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {preAction && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 2,
          }}
        >
          <View
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#4edea3',
            }}
          />
          <Text
            allowFontScaling={false}
            style={{
              color: 'rgba(78,222,163,0.5)',
              fontSize: 9,
              fontWeight: '700',
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            Queued
          </Text>
        </View>
      )}
    </View>
  );
}

/* ── Breathing border (action-bar-breath keyframes) ──────────────────────── */
function BreathingRing({ active }: { active: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    } else {
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [active, opacity]);

  const ring = useAnimatedStyle(() => ({ opacity: opacity.value * 0.6 }));
  const halo = useAnimatedStyle(() => ({ opacity: opacity.value * 0.5 }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: -1,
            left: -1,
            right: -1,
            bottom: -1,
            borderRadius: 17,
            borderWidth: 2,
            borderColor: 'rgba(78,222,163,0.6)',
          },
          ring,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: 20,
            borderWidth: 6,
            borderColor: 'rgba(78,222,163,0.18)',
          },
          halo,
        ]}
      />
    </>
  );
}

/* ── Raise panel (PWA RaiseSlider panel around the ui-native track) ──────── */
type PresetMode = 'bb' | 'pot';

function RaisePanel({
  min,
  max,
  step,
  pot,
  bigBlind,
  amount,
  onAmount,
  onConfirm,
  onCancel,
  onFeedback,
}: {
  min: number;
  max: number;
  step: number;
  pot: number;
  bigBlind: number;
  amount: number;
  onAmount: (v: number) => void;
  onConfirm: (v: number) => void;
  onCancel: () => void;
  onFeedback: (
    event: 'sliderTick' | 'sliderConfirm' | 'raise' | 'buttonClick',
    volume?: number,
  ) => void;
}) {
  const [presetMode, setPresetMode] = useState<PresetMode>('bb');
  const lastTickRef = useRef(0);

  const triggerTick = useCallback(() => {
    const now = Date.now();
    if (now - lastTickRef.current > 80) {
      lastTickRef.current = now;
      onFeedback('sliderTick');
    }
  }, [onFeedback]);

  const increment = useCallback(
    (byStep: number) => {
      onAmount(Math.min(Math.max(amount + byStep, min), max));
      triggerTick();
    },
    [amount, min, max, onAmount, triggerTick],
  );

  const decrement = useCallback(
    (byStep: number) => {
      onAmount(Math.min(Math.max(amount - byStep, min), max));
      triggerTick();
    },
    [amount, min, max, onAmount, triggerTick],
  );

  // Fixed 10 presets → 2 rows of 5 (exact PWA configs).
  const presets = useMemo(() => {
    const configs =
      presetMode === 'bb'
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
            { label: '10%', value: pot * 0.1 },
            { label: '25%', value: pot * 0.25 },
            { label: '33%', value: pot * (1 / 3) },
            { label: '50%', value: pot * 0.5 },
            { label: '75%', value: pot * 0.75 },
            { label: '100%', value: pot * 1.0 },
            { label: '150%', value: pot * 1.5 },
            { label: '200%', value: pot * 2.0 },
            { label: '300%', value: pot * 3.0 },
            { label: 'All', value: max, isSpecial: true },
          ];

    return configs.map((p) => {
      const val = Math.round(p.value / step) * step;
      const isDisabled = !p.isSpecial && (val < min || val > max);
      return { ...p, value: p.isSpecial ? p.value : val, isDisabled };
    });
  }, [min, max, step, pot, bigBlind, presetMode]);

  const potRatio = pot > 0 ? (amount / pot) * 100 : 0;

  return (
    <View
      style={{
        backgroundColor: 'rgba(8,8,8,0.95)',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Header, toggle & close */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 4,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text
            allowFontScaling={false}
            style={{
              color: '#4edea3',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            Raise Amount
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: 4,
              backgroundColor: 'rgba(255,255,255,0.05)',
              padding: 4,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
            }}
          >
            {(['bb', 'pot'] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setPresetMode(mode)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 4,
                  backgroundColor: presetMode === mode ? 'rgba(78,222,163,0.2)' : 'transparent',
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    color: presetMode === mode ? '#4edea3' : 'rgba(199,198,203,0.6)',
                    fontSize: 8,
                    fontWeight: '700',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  {mode === 'bb' ? 'BB' : 'Pot %'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable
          onPress={() => {
            onCancel();
            onFeedback('buttonClick');
          }}
          hitSlop={8}
        >
          <XIcon size={16} color="#c7c6cb" />
        </Pressable>
      </View>

      {/* Display & adjusters */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <Pressable
          onPress={() => decrement(bigBlind)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(70,70,75,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MinusIcon size={16} color="#c7c6cb" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            allowFontScaling={false}
            style={{
              color: '#4edea3',
              fontSize: 24,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
            }}
          >
            ${amount.toLocaleString('en-US')}
          </Text>
          {pot > 0 && (
            <Text
              allowFontScaling={false}
              style={{
                color: 'rgba(199,198,203,0.7)',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {potRatio.toFixed(0)}% Pot
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => increment(bigBlind)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(70,70,75,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PlusIcon size={16} color="#c7c6cb" />
        </Pressable>
      </View>

      {/* Track (ui-native RaiseSlider — 6px track, 20px radial thumb) */}
      <View style={{ paddingVertical: 8 }}>
        <RaiseSlider
          min={min}
          max={max}
          step={step}
          value={amount}
          onChange={(v) => {
            onAmount(v);
          }}
          onTick={() => {
            triggerTick();
          }}
        />
      </View>

      {/* Presets grid — strict 5 columns, 2 rows */}
      <View style={{ paddingHorizontal: 4, paddingVertical: 8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {presets.map((preset) => (
            <Pressable
              key={preset.label}
              disabled={preset.isDisabled}
              onPress={() => {
                onAmount(preset.value);
                onFeedback('sliderConfirm');
              }}
              style={{
                width: `${(100 - 4 * 6) / 5}%` as `${number}%`,
                paddingVertical: 6,
                borderRadius: 6,
                alignItems: 'center',
                borderWidth: 1,
                borderColor:
                  amount === preset.value && !preset.isDisabled
                    ? '#4edea3'
                    : 'rgba(255,255,255,0.05)',
                backgroundColor: preset.isDisabled
                  ? 'rgba(255,255,255,0.02)'
                  : amount === preset.value
                    ? '#4edea3'
                    : 'rgba(255,255,255,0.05)',
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontSize: 9,
                  fontWeight: '700',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: preset.isDisabled
                    ? 'rgba(255,255,255,0.15)'
                    : amount === preset.value
                      ? '#003824'
                      : '#c7c6cb',
                }}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Confirm */}
      <Pressable
        onPress={() => {
          onConfirm(amount);
          const intensityScale = max > min ? amount / max : 0.5;
          onFeedback('raise', 0.5 + intensityScale * 0.5);
        }}
        style={{
          width: '100%',
          paddingVertical: 10,
          borderRadius: 6,
          backgroundColor: '#4edea3',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          marginTop: 6,
        }}
      >
        <CheckIcon size={14} color="#003824" />
        <Text
          allowFontScaling={false}
          style={{
            color: '#003824',
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          Confirm Raise
        </Text>
      </Pressable>
    </View>
  );
}

/* ── Shared action bar props ─────────────────────────────────────────────── */
export interface ActionBarProps {
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
  /** Fires sliderTick/sliderConfirm/raise/buttonClick through useFeedback. */
  onFeedback?: (
    event: 'sliderTick' | 'sliderConfirm' | 'raise' | 'buttonClick',
    amount?: number,
    volume?: number,
  ) => void;
}

function GlassPanel({
  children,
  borderRadius,
}: {
  children: React.ReactNode;
  borderRadius: number;
}) {
  return (
    <View
      style={{
        borderRadius,
        backgroundColor: 'rgba(8, 8, 8, 0.85)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderTopColor: 'rgba(255,255,255,0.14)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.9,
        shadowRadius: 48,
        elevation: 20,
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.04)',
        }}
      />
      {children}
    </View>
  );
}

function useActionBarState(props: ActionBarProps) {
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [preActionOpen, setPreActionOpen] = useState(false);
  const [actionSent, setActionSent] = useState(false);
  const [amount, setAmount] = useState(props.minRaise || 10);
  const actionSentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { actionRequired, toCall, minRaise, onAction, heroStack } = props;

  const isCheck = toCall === 0;
  const isAllInCall = heroStack > 0 && heroStack < toCall;
  const callLabel = isCheck
    ? 'Check'
    : isAllInCall
      ? `All-in ${formatCurrency(heroStack)}`
      : `Call ${formatCurrency(toCall)}`;

  const allInDisabled = !actionRequired || heroStack === 0;

  const handleAction = useCallback(
    (action: string, actAmount?: number) => {
      onAction(action, actAmount);
      setActionSent(true);
      if (actionSentTimerRef.current) clearTimeout(actionSentTimerRef.current);
      actionSentTimerRef.current = setTimeout(() => setActionSent(false), 2500);
    },
    [onAction],
  );

  const toggleRaise = useCallback(() => {
    setAmount(minRaise || 10);
    setRaiseOpen((p) => !p);
  }, [minRaise]);

  const visibleAction = useVisibleAction(props.executingAction, toCall);
  const isActing = !!visibleAction || actionSent;
  const layoutActionRequired = actionRequired || isActing;

  return {
    raiseOpen,
    setRaiseOpen,
    drawerOpen,
    setDrawerOpen,
    preActionOpen,
    setPreActionOpen,
    amount,
    setAmount,
    isCheck,
    isAllInCall,
    callLabel,
    allInDisabled,
    handleAction,
    toggleRaise,
    visibleAction,
    isActing,
    layoutActionRequired,
  };
}

/* ── Desktop variant ─────────────────────────────────────────────────────── */
const DesktopActionBar = memo(function DesktopActionBar(props: ActionBarProps) {
  const s = useActionBarState(props);
  const { actionRequired, minRaise, maxRaise, bigBlind = 10, pot, toCall, canRaise } = props;
  const sparkIndex = useRandomSparkle(!actionRequired && !s.raiseOpen);
  const onFeedback = props.onFeedback ?? (() => {});

  const getPreActionLabel = () => {
    if (!props.preAction) return 'Auto';
    return `Auto: ${props.preAction.type.replace(/_/g, ' ')}`;
  };

  return (
    <View style={{ alignItems: 'center', paddingBottom: 8 }}>
      <View style={{ width: '100%', maxWidth: 560 }}>
        <GlassPanel borderRadius={16}>
          <BreathingRing active={actionRequired} />
          <ExecutionBanner visibleAction={s.visibleAction} />

          {s.raiseOpen && actionRequired && canRaise ? (
            <RaisePanel
              min={minRaise || 10}
              max={maxRaise || 1000}
              step={bigBlind || 10}
              pot={pot || 0}
              bigBlind={bigBlind || 10}
              amount={s.amount}
              onAmount={s.setAmount}
              onConfirm={(amt) => {
                s.handleAction('raise', amt);
                s.setRaiseOpen(false);
              }}
              onCancel={() => s.setRaiseOpen(false)}
              onFeedback={onFeedback}
            />
          ) : (
            <>
              {s.preActionOpen && !s.layoutActionRequired && (
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                  <PreActionPanel
                    preAction={props.preAction}
                    onSetPreAction={props.onSetPreAction}
                    toCall={toCall}
                  />
                  <View
                    style={{
                      marginTop: 4,
                      height: 1,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      marginHorizontal: -16,
                    }}
                  />
                </View>
              )}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'stretch',
                  gap: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                }}
              >
                {!s.layoutActionRequired && (
                  <Pressable
                    onPress={() => s.setPreActionOpen(!s.preActionOpen)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: props.preAction
                        ? 'rgba(78,222,163,0.3)'
                        : 'rgba(255,255,255,0.08)',
                      backgroundColor: props.preAction
                        ? 'rgba(78,222,163,0.1)'
                        : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <BotIcon
                      size={16}
                      color={props.preAction ? '#4edea3' : 'rgba(255,255,255,0.25)'}
                    />
                    <Text
                      allowFontScaling={false}
                      style={{
                        color: props.preAction ? '#4edea3' : 'rgba(255,255,255,0.25)',
                        fontSize: 10,
                        fontWeight: '700',
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                      }}
                    >
                      {getPreActionLabel()}
                    </Text>
                  </Pressable>
                )}

                <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
                  <ActionBtn
                    variant="fold"
                    onPress={() => s.handleAction('fold')}
                    disabled={!actionRequired}
                    sparkId={0}
                    currentSpark={sparkIndex}
                  >
                    Fold
                  </ActionBtn>
                  <ActionBtn
                    variant="call"
                    onPress={() => s.handleAction(s.isCheck ? 'check' : 'call')}
                    disabled={!actionRequired}
                    IconOverride={s.isCheck ? CheckIcon : undefined}
                    sparkId={1}
                    currentSpark={sparkIndex}
                  >
                    {s.callLabel}
                  </ActionBtn>
                  <ActionBtn
                    variant="raise"
                    onPress={s.toggleRaise}
                    disabled={!actionRequired || !canRaise}
                    sparkId={2}
                    currentSpark={sparkIndex}
                  >
                    {s.raiseOpen ? 'Close' : 'Raise'}
                  </ActionBtn>
                  <ActionBtn
                    variant="all-in"
                    onPress={() => s.handleAction('all-in')}
                    disabled={s.allInDisabled}
                    sparkId={3}
                    currentSpark={sparkIndex}
                  >
                    All-in
                  </ActionBtn>
                </View>
              </View>
            </>
          )}
        </GlassPanel>
      </View>
    </View>
  );
});

/* ── Mobile variant ──────────────────────────────────────────────────────── */
const MOBILE_BREAK = 390;

const MobileActionBar = memo(function MobileActionBar(props: ActionBarProps) {
  const s = useActionBarState(props);
  const { actionRequired, minRaise, maxRaise, bigBlind = 10, pot, toCall, canRaise } = props;
  const sparkIndex = useRandomSparkle(!actionRequired && !s.raiseOpen);
  const [containerW, setContainerW] = useState(0);
  const isNarrow = containerW > 0 && containerW < MOBILE_BREAK;

  const foldBtn = (
    <ActionBtn
      variant="fold"
      onPress={() => s.handleAction('fold')}
      disabled={!actionRequired}
      sparkId={0}
      currentSpark={sparkIndex}
    >
      Fold
    </ActionBtn>
  );
  const callBtn = (
    <ActionBtn
      variant="call"
      onPress={() => s.handleAction(s.isCheck ? 'check' : 'call')}
      disabled={!actionRequired}
      IconOverride={s.isCheck ? CheckIcon : undefined}
      sparkId={1}
      currentSpark={sparkIndex}
    >
      {s.callLabel}
    </ActionBtn>
  );
  const raiseBtn = (
    <ActionBtn
      variant="raise"
      onPress={s.toggleRaise}
      disabled={!actionRequired || !canRaise}
      sparkId={2}
      currentSpark={sparkIndex}
    >
      {s.raiseOpen ? 'Close' : 'Raise'}
    </ActionBtn>
  );
  const allInBtn = (
    <ActionBtn
      variant="all-in"
      onPress={() => s.handleAction('all-in')}
      disabled={s.allInDisabled}
      sparkId={3}
      currentSpark={sparkIndex}
    >
      All-in
    </ActionBtn>
  );

  const getPreActionText = () => (!props.preAction ? '' : props.preAction.type.replace(/_/g, ' '));

  const onFeedback = props.onFeedback ?? (() => {});

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (Math.abs(containerW - w) > 0.5) setContainerW(w);
      }}
      style={{ width: '100%' }}
    >
      <GlassPanel borderRadius={0}>
        <BreathingRing active={actionRequired} />
        <ExecutionBanner visibleAction={s.visibleAction} />

        {s.raiseOpen && actionRequired && canRaise ? (
          <RaisePanel
            min={minRaise || 10}
            max={maxRaise || 1000}
            step={bigBlind || 10}
            pot={pot || 0}
            bigBlind={bigBlind || 10}
            amount={s.amount}
            onAmount={s.setAmount}
            onConfirm={(amt) => {
              s.handleAction('raise', amt);
              s.setRaiseOpen(false);
            }}
            onCancel={() => s.setRaiseOpen(false)}
            onFeedback={onFeedback}
          />
        ) : (
          <View style={{ paddingHorizontal: 12, paddingVertical: 12, gap: 8 }}>
            {isNarrow ? (
              <>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>{foldBtn}</View>
                  <View style={{ flex: 2.5 }}>{callBtn}</View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>{raiseBtn}</View>
                  <View style={{ flex: 1 }}>{allInBtn}</View>
                </View>
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
                <View style={{ flex: 1, minWidth: 0 }}>{foldBtn}</View>
                <View style={{ flex: 1.4, minWidth: 0 }}>{callBtn}</View>
                <View style={{ flex: 1, minWidth: 0 }}>{raiseBtn}</View>
                <View style={{ flex: 1, minWidth: 0 }}>{allInBtn}</View>
              </View>
            )}

            {!s.layoutActionRequired && (
              <Pressable
                onPress={() => s.setDrawerOpen(!s.drawerOpen)}
                style={{
                  width: '100%',
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: props.preAction ? 'rgba(78,222,163,0.3)' : 'rgba(255,255,255,0.06)',
                  backgroundColor: props.preAction
                    ? 'rgba(78,222,163,0.1)'
                    : 'rgba(255,255,255,0.02)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <BotIcon size={12} color={props.preAction ? '#4edea3' : 'rgba(255,255,255,0.2)'} />
                <Text
                  allowFontScaling={false}
                  style={{
                    color: props.preAction ? '#4edea3' : 'rgba(255,255,255,0.2)',
                    fontSize: 9,
                    fontWeight: '700',
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                  }}
                >
                  {props.preAction ? `Auto: ${getPreActionText()}` : 'Auto'}
                </Text>
              </Pressable>
            )}

            {s.drawerOpen && !s.layoutActionRequired && (
              <View>
                <View style={{ paddingVertical: 8 }}>
                  <PreActionPanel
                    preAction={props.preAction}
                    onSetPreAction={props.onSetPreAction}
                    toCall={toCall}
                    compact
                  />
                </View>
                <View
                  style={{
                    height: 1,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    marginHorizontal: -12,
                  }}
                />
              </View>
            )}
          </View>
        )}
      </GlassPanel>
    </View>
  );
});

/* ── Export ──────────────────────────────────────────────────────────────── */
export const ActionBar = memo(function ActionBar(props: ActionBarProps) {
  return props.isDesktop ? <DesktopActionBar {...props} /> : <MobileActionBar {...props} />;
});
