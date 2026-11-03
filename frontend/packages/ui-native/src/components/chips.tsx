import { useEffect, useMemo, useRef } from 'react';
import { type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { chipBody, chips as chipTokens, colors, fonts } from '../tokens';

/** Chip color scheme (compat with PWA AnimatedChip#getChipColor). */
export interface ChipColors {
  bg: string;
  edge: string;
  highlight: string;
  text: string;
}

/** PWA default premium chip palette. */
export const DEFAULT_CHIP_COLORS: ChipColors = {
  bg: '#1a1a1a',
  edge: '#333333',
  highlight: '#ffffff',
  text: '#cfcfcf',
};

export interface ChipUnit {
  /** Denomination value (1/5/25/100/500/1000). */
  value: number;
  /** Repeat count for this denomination. */
  count: number;
}

/**
 * Greedy decomposition of an amount into {@link chipTokens.denominations}
 * (largest first). Used by {@link ChipStack} and available to A3 for bet
 * chip piles.
 */
export function decomposeIntoChips(
  amount: number,
  denominations = chipTokens.denominations,
): ChipUnit[] {
  let rest = Math.max(0, Math.floor(amount));
  const units: ChipUnit[] = [];
  for (const d of [...denominations].sort((a, b) => b.value - a.value)) {
    if (rest <= 0) break;
    const count = Math.floor(rest / d.value);
    if (count > 0) {
      units.push({ value: d.value, count });
      rest -= count * d.value;
    }
  }
  return units;
}

function ChipDisc({ size, value }: { size: number; value: number }) {
  const d = chipTokens.denominations.find((x) => x.value === value) ?? chipTokens.denominations[2];
  const showLabel = size >= 22;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: d.color,
        borderWidth: 2,
        borderColor: d.ringColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: size * 0.12,
          left: size * 0.12,
          right: size * 0.12,
          bottom: size * 0.12,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: d.ringColor,
          opacity: 0.55,
        }}
      />
      {showLabel && (
        <Text
          allowFontScaling={false}
          style={{
            color: d.textColor,
            fontFamily: fonts.data,
            fontSize: Math.round(size * 0.32),
            fontWeight: '700',
            includeFontPadding: false,
          }}
        >
          {d.value >= 1000 ? `${d.value / 1000}k` : d.value}
        </Text>
      )}
    </View>
  );
}

export interface ChipStackProps {
  /** Amount in chips — decomposed into denominations for the stack. */
  amount: number;
  /** Show the PWA-style `$amount` pill under the stack. */
  showLabel?: boolean;
  /** Chip diameter in px (default tokens.chips.chipSize = 28). */
  size?: number;
  /** Max discs rendered (excess denominations collapse). */
  maxChips?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Stack of denomination chips + amount pill — extends the PWA ChipStack
 * (which only renders the pill) with the physical stack requested by the
 * mobile plan, using `tokens.chips` denominations/colors and the 3px
 * stacking offset. Spring-pops (0.8 → 1) when the amount changes.
 */
export function ChipStack({
  amount,
  showLabel = true,
  size = chipTokens.chipSize,
  maxChips = 8,
  style,
}: ChipStackProps) {
  const scale = useSharedValue(0.8);

  const units = useMemo(() => {
    const flat: number[] = [];
    for (const u of decomposeIntoChips(amount)) {
      for (let i = 0; i < u.count; i++) flat.push(u.value);
    }
    // ascending → smallest rendered last (top of the visual stack)
    return flat.sort((a, b) => a - b).slice(0, maxChips);
  }, [amount, maxChips]);

  useEffect(() => {
    scale.value = 0.8;
    scale.value = withSpring(1, { stiffness: 300, damping: 20 });
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ alignItems: 'center' }, animStyle, style]}>
      <View style={{ alignItems: 'center' }}>
        {units.map((value, i) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: stack position is the chip's identity
            key={`${value}-${i}`}
            style={i > 0 ? { marginTop: -(size - chipTokens.stackOffset) } : undefined}
          >
            <ChipDisc size={size} value={value} />
          </View>
        ))}
      </View>

      {showLabel && (
        <View
          style={{
            marginTop: units.length > 0 ? 4 : 0,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderWidth: 1,
            borderColor: 'rgba(78,222,163,0.3)',
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              color: colors.accent,
              fontFamily: fonts.data,
              fontSize: 12,
              fontWeight: '700',
              includeFontPadding: false,
            }}
          >
            ${amount.toLocaleString()}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

export interface AnimatedChipProps {
  /** Start point in parent coordinates. */
  from: { x: number; y: number };
  /** End point in parent coordinates (pot). */
  to: { x: number; y: number };
  /** Seconds before the toss starts (PWA parity). */
  delay?: number;
  /** Seconds for the whole toss (PWA parity). */
  duration?: number;
  /** Arc height in px. */
  arcHeight?: number;
  /** Chip diameter in px. */
  size?: number;
  /** Lateral index — alternates mid-point offset ±20px like the PWA. */
  index?: number;
  xOffset?: number;
  yOffset?: number;
  zIndex?: number;
  colors?: ChipColors;
  /** Called once when the toss finishes. */
  onComplete?: () => void;
}

/**
 * Premium metal chip tossed from a seat to the pot — Reanimated port of PWA
 * AnimatedChip (Framer keyframes [0, 0.15, 0.85, 1], ease
 * cubic-bezier(0.25, 0.46, 0.45, 0.94)). Runs entirely on the UI thread via
 * shared values; the chip body keeps the PWA's machined rim / recessed face /
 * gloss layers (inset box-shadows emulated with bordered Views).
 */
export function AnimatedChip({
  from,
  to,
  delay = 0,
  duration = 0.6,
  arcHeight = 30,
  size = 24,
  index = 0,
  xOffset = 0,
  yOffset = 0,
  zIndex = 500,
  colors: chipColors = DEFAULT_CHIP_COLORS,
  onComplete,
}: AnimatedChipProps) {
  const startX = from.x + xOffset - size / 2;
  const startY = from.y + yOffset - size / 2;
  const endX = to.x + xOffset - size / 2;
  const endY = to.y + yOffset - size / 2;
  const midX = (from.x + to.x) / 2 + (index % 2 === 0 ? 20 : -20) - size / 2;
  const midY = Math.min(from.y, to.y) - arcHeight - index * 3 - size / 2;

  const x = useSharedValue(startX);
  const y = useSharedValue(startY);
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const easing = Easing.bezier(0.25, 0.46, 0.45, 0.94);
    const d = duration * 1000;
    x.value = startX;
    y.value = startY;
    scale.value = 0.8;
    opacity.value = 0;

    x.value = withDelay(
      delay * 1000,
      withSequence(
        withTiming(midX, { duration: d * 0.15, easing }),
        withTiming(endX, { duration: d * 0.7, easing }),
        withTiming(endX, { duration: d * 0.15, easing }),
      ),
    );
    y.value = withDelay(
      delay * 1000,
      withSequence(
        withTiming(midY, { duration: d * 0.15, easing }),
        withTiming(endY, { duration: d * 0.7, easing }),
        withTiming(endY, { duration: d * 0.15, easing }),
      ),
    );
    scale.value = withDelay(
      delay * 1000,
      withSequence(
        withTiming(1.1, { duration: d * 0.15, easing }),
        withTiming(0.7, { duration: d * 0.7, easing }),
        withTiming(0.7, { duration: d * 0.15, easing }),
      ),
    );
    opacity.value = withDelay(
      delay * 1000,
      withSequence(
        withTiming(1, { duration: d * 0.15, easing }),
        withTiming(1, { duration: d * 0.7, easing }),
        withTiming(0, { duration: d * 0.15, easing }),
      ),
    );

    timeoutRef.current = setTimeout(() => onComplete?.(), (delay + duration) * 1000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // Re-toss only when the trajectory actually changes.
  }, [startX, startY, endX, endY, midX, midY, delay, duration, x, y, scale, opacity, onComplete]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const rim = chipBody.rimStops;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          zIndex,
        },
        animStyle,
      ]}
    >
      {/* Machined rim (diagonal brushed gradient) */}
      <View
        style={{
          width: '100%',
          height: '100%',
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: chipColors.bg,
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="sbChipRim" x1="0" y1="0" x2="1" y2="1">
              {rim.map((s) => (
                <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width={100} height={100} fill="url(#sbChipRim)" />
        </Svg>

        {/* Top bevel highlight (inset 0 4px 6px white/25 emulation) */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: size * 0.15,
            right: size * 0.15,
            height: size * 0.08,
            borderRadius: size * 0.04,
            backgroundColor: chipColors.highlight,
            opacity: 0.25,
          }}
        />
      </View>

      {/* Recessed center face with decal rings (0 0 0 2px/4px/5px emulation) */}
      <View
        style={{
          position: 'absolute',
          top: size * 0.15,
          left: size * 0.15,
          right: size * 0.15,
          bottom: size * 0.15,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: chipBody.ringColors[2],
          backgroundColor: chipColors.edge,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: '100%',
            height: '100%',
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: chipBody.ringColors[1],
            backgroundColor: chipColors.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: '100%',
              height: '100%',
              borderRadius: size / 2,
              borderWidth: 1,
              borderColor: chipBody.ringColors[0],
              backgroundColor: '#111111',
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Defs>
                <RadialGradient id="sbChipFace" cx="0.35" cy="0.3" r="0.9">
                  {chipBody.faceStops.map((s) => (
                    <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
                  ))}
                </RadialGradient>
              </Defs>
              <Rect width={100} height={100} fill="url(#sbChipFace)" />
            </Svg>
            {/* subtle inner detail ring */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: '60%',
                height: '60%',
                borderRadius: size / 2,
                borderWidth: 1,
                borderColor: chipBody.innerRing,
              }}
            />
          </View>
        </View>
      </View>

      {/* Sharp top gloss reflection (blur not available — lowered opacity) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: size * 0.08,
          left: size * 0.15,
          width: size * 0.7,
          height: size * 0.35,
          borderRadius: size * 0.175,
          backgroundColor: chipBody.gloss,
          opacity: 0.18,
          transform: [{ rotate: '-15deg' }],
        }}
      />
    </Animated.View>
  );
}
