import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { timer } from '../tokens';

export interface TimerBarProps {
  /** ms left on the clock; hides the bar when null/undefined. */
  remainingMs?: number | null;
  /** Full window ms; defaults to remainingMs when omitted. */
  totalMs?: number | null;
  /** Direct 0..1 progress override (wins over remainingMs/totalMs). */
  progress?: number;
  /** Active turn — brighter bar, glow, critical pulse. */
  isActive?: boolean;
  /** Bar thickness in px (PWA h-1 = 4). */
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Turn timer bar — Reanimated port of PWA TimerBar. Progress animates the
 * fill width (0.1s linear, per PWA); the fill color ramps green → amber →
 * red across 100% → 50% → 0%; an animated-opacity halo emulates the glow
 * box-shadow; below 20% (critical) the bar pulses while active.
 */
export function TimerBar({
  remainingMs,
  totalMs,
  progress,
  isActive = false,
  height = timer.height,
  style,
}: TimerBarProps) {
  const hasTime = progress != null || remainingMs != null;
  const rem = remainingMs ?? 0;
  const total = totalMs ?? rem;
  const raw = progress != null ? progress : total > 0 ? Math.max(0, Math.min(1, rem / total)) : 0;

  const p = useSharedValue(raw);
  const [containerW, setContainerW] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerW((prev) =>
      Math.abs(prev - e.nativeEvent.layout.width) < 0.5 ? prev : e.nativeEvent.layout.width,
    );
  };

  useEffect(() => {
    p.value = withTiming(raw, { duration: 100, easing: Easing.linear });
  }, [raw, p]);

  // Critical pulse / active opacity — re-armed only per state change.
  const opacity = useSharedValue(isActive ? 1 : timer.inactiveOpacity);
  useEffect(() => {
    const pct = raw * 100;
    const critical = isActive && pct <= timer.criticalThreshold && pct > 0;
    if (critical) {
      opacity.value = withRepeat(
        withTiming(0.4, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      opacity.value = withTiming(isActive ? 1 : timer.inactiveOpacity, { duration: 300 });
    }
  }, [raw, isActive, opacity]);

  const fillColor = useDerivedValue(() =>
    interpolateColor(p.value, [0, 0.5, 1], [timer.red, timer.amber, timer.green], 'RGB'),
  );

  const clampW = (v: number) => Math.max(0, Math.min(containerW, v));

  const fillStyle = useAnimatedStyle(() => ({
    width: clampW(p.value * containerW),
    backgroundColor: fillColor.value,
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    width: clampW(p.value * containerW),
    backgroundColor: fillColor.value,
    opacity: isActive ? timer.glowOpacity : 0,
  }));

  if (!hasTime) return null;

  const glowHeight = height + 6;

  return (
    <View
      onLayout={onLayout}
      style={[{ width: '100%', height: glowHeight, justifyContent: 'center' }, style]}
    >
      {/* glow halo (box-shadow emulation) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: glowHeight,
          justifyContent: 'center',
        }}
      >
        <Animated.View style={[{ height: glowHeight, borderRadius: glowHeight }, glowStyle]} />
      </View>
      <View
        style={{
          width: '100%',
          height,
          borderRadius: height,
          backgroundColor: timer.trackColor,
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[{ height }, fillStyle]} />
      </View>
    </View>
  );
}
