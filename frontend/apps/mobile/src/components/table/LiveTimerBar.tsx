/**
 * Shared-value-driven twin of `@stackbluff/ui-native` TimerBar.
 *
 * ui-native TimerBar is prop-driven (`remainingMs`), which would force a
 * JS re-render per update; the table renders this variant instead, passing
 * the `useTurnCountdown` progress SharedValue so the fill width, green →
 * amber → red ramp, glow halo and critical pulse all run on the UI thread
 * with zero JS ticks. Visual values are token-identical to TimerBar
 * (`tokens.timer`).
 */

import { timer } from '@stackbluff/ui-native';
import { memo, useEffect } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export interface LiveTimerBarProps {
  /** Remaining fraction 1 → 0 (from useTurnCountdown). */
  progress: SharedValue<number>;
  /** Active turn — brighter bar, glow, critical pulse. */
  isActive?: boolean;
  /** Bar thickness in px (PWA h-1 = 4). */
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export const LiveTimerBar = memo(function LiveTimerBar({
  progress,
  isActive = false,
  height = timer.height,
  style,
}: LiveTimerBarProps) {
  const containerW = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(containerW.value - w) > 0.5) containerW.value = w;
  };

  // 400ms ping-pong pulse, running on the UI thread — only sampled while
  // the bar is in the critical state (same 400ms loop as ui-native TimerBar).
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 400 }), -1, true);
  }, [pulse]);

  const fillColor = useDerivedValue(() =>
    interpolateColor(progress.value, [0, 0.5, 1], [timer.red, timer.amber, timer.green], 'RGB'),
  );

  const critical = useDerivedValue(
    () => isActive && progress.value * 100 <= timer.criticalThreshold,
  );

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, Math.min(containerW.value, progress.value * containerW.value)),
    backgroundColor: fillColor.value,
    opacity: isActive ? (critical.value ? 0.6 + 0.4 * pulse.value : 1) : timer.inactiveOpacity,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    width: Math.max(0, Math.min(containerW.value, progress.value * containerW.value)),
    backgroundColor: fillColor.value,
    opacity: isActive ? timer.glowOpacity : 0,
  }));

  const glowHeight = height + 6;

  return (
    <View
      onLayout={onLayout}
      style={[{ width: '100%', height: glowHeight, justifyContent: 'center' }, style]}
    >
      {/* glow halo (TimerBar box-shadow emulation) */}
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
});
