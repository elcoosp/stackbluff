import { useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { motionPresets } from '../motion/presets';
import { colors, slider } from '../tokens';

export interface RaiseSliderProps {
  /** Lower bound (chips). */
  min: number;
  /** Upper bound (chips). */
  max: number;
  /** Controlled current value. */
  value: number;
  /** Called with the quantized value on every meaningful change. */
  onChange: (value: number) => void;
  /** Quantization step (default 1). */
  step?: number;
  /**
   * Haptic/audio tick hook — throttled to one call per 80ms while dragging
   * (A5 wires this to the platform feedback surface).
   */
  onTick?: (value: number) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Controlled raise slider — native port of the PWA RaiseSlider custom track:
 * 6px rounded track, accent fill left of the thumb, 20px radial-gradient
 * thumb with white/20 border that scales to 1.15 with an emerald active
 * ring while dragging.
 *
 * Drag handling uses the RN responder system + Reanimated shared values
 * (fill width and thumb translate animate on the UI thread). NOTE: the
 * mobile-plan spec asks for react-native-gesture-handler `Gesture.Pan`;
 * gesture-handler is not a resolvable dependency of this package (pnpm
 * strict) so the pan was implemented with responders — see worklog
 * DEP REQUESTS; the swap is mechanical once the dep lands.
 */
export function RaiseSlider({
  min,
  max,
  value,
  onChange,
  step = 1,
  onTick,
  disabled = false,
  style,
}: RaiseSliderProps) {
  const [trackW, setTrackW] = useState(0);
  const trackWRef = useSharedValue(0);
  const thumbX = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const thumbScale = useSharedValue(1);
  const draggingRef = useRef(false);
  const lastValueRef = useRef(value);
  const lastTickRef = useRef(0);

  const range = max > min ? max - min : 1;
  const ratioOf = useCallback(
    (v: number) => Math.max(0, Math.min(1, (v - min) / range)),
    [min, range],
  );

  const quantize = useCallback(
    (v: number) => {
      const s = step > 0 ? step : 1;
      const q = Math.round(v / s) * s;
      return Math.min(max, Math.max(min, q));
    },
    [step, min, max],
  );

  // Sync external value → thumb (skipped while the user is dragging).
  useEffect(() => {
    if (trackW <= 0) return;
    if (!draggingRef.current) {
      thumbX.value = withTiming(ratioOf(value) * trackW, { duration: 100 });
      lastValueRef.current = value;
    }
  }, [value, trackW, ratioOf, thumbX]);

  const setFromLocation = useCallback(
    (locationX: number) => {
      const w = trackWRef.value;
      if (w <= 0) return;
      const x = Math.max(0, Math.min(w, locationX));
      const q = quantize(min + (x / w) * range);
      if (q === lastValueRef.current) return;
      lastValueRef.current = q;
      thumbX.value = ratioOf(q) * w;
      onChange(q);
      const now = Date.now();
      if (now - lastTickRef.current > slider.tickIntervalMs) {
        lastTickRef.current = now;
        onTick?.(q);
      }
    },
    [quantize, min, range, onChange, onTick, ratioOf, thumbX, trackWRef],
  );

  const onTrackLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      trackWRef.value = w;
      setTrackW((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
    },
    [trackWRef],
  );

  const handleGrant = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      if (disabled) return;
      draggingRef.current = true;
      ringOpacity.value = withTiming(1, { duration: 120 });
      thumbScale.value = withSpring(slider.thumbActiveScale, motionPresets.pressSpring);
      setFromLocation(e.nativeEvent.locationX);
    },
    [disabled, ringOpacity, thumbScale, setFromLocation],
  );

  const handleMove = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      if (disabled || !draggingRef.current) return;
      setFromLocation(e.nativeEvent.locationX);
    },
    [disabled, setFromLocation],
  );

  const handleRelease = useCallback(() => {
    draggingRef.current = false;
    ringOpacity.value = withTiming(0, { duration: 150 });
    thumbScale.value = withSpring(1, motionPresets.pressSpring);
  }, [ringOpacity, thumbScale]);

  const fillStyle = useAnimatedStyle(() => ({
    width: trackWRef.value > 0 ? thumbX.value : 0,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value - slider.thumbSize / 2 }, { scale: thumbScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
  }));

  return (
    <View
      style={[{ width: '100%', paddingVertical: 8 }, style]}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled && draggingRef.current}
      onResponderGrant={handleGrant}
      onResponderMove={handleMove}
      onResponderRelease={handleRelease}
      onResponderTerminationRequest={() => !draggingRef.current}
    >
      <View onLayout={onTrackLayout} style={{ height: 24, justifyContent: 'center' }}>
        {/* Track + fill */}
        <View
          style={{
            width: '100%',
            height: slider.trackHeight,
            borderRadius: slider.trackHeight,
            backgroundColor: slider.trackColor,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={[
              {
                height: slider.trackHeight,
                borderRadius: slider.trackHeight,
                backgroundColor: colors.accent,
              },
              fillStyle,
            ]}
          />
        </View>

        {/* Thumb */}
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: 0, top: (24 - slider.thumbSize) / 2 }, thumbStyle]}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: -slider.activeRingWidth,
                left: -slider.activeRingWidth,
                width: slider.thumbSize + slider.activeRingWidth * 2,
                height: slider.thumbSize + slider.activeRingWidth * 2,
                borderRadius: (slider.thumbSize + slider.activeRingWidth * 2) / 2,
                borderWidth: slider.activeRingWidth,
                borderColor: slider.activeRing,
              },
              ringStyle,
            ]}
          />
          <View
            style={{
              width: slider.thumbSize,
              height: slider.thumbSize,
              borderRadius: slider.thumbSize / 2,
              borderWidth: 2,
              borderColor: slider.thumbBorder,
              overflow: 'hidden',
              backgroundColor: '#1a1a1a',
            }}
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Defs>
                <RadialGradient id="sbSliderThumb" cx="0.35" cy="0.35" r="0.9">
                  {slider.thumbStops.map((stop, i) => (
                    <Stop key={stop} offset={i === 0 ? 0 : i === 1 ? 0.6 : 1} stopColor={stop} />
                  ))}
                </RadialGradient>
              </Defs>
              <Rect width={100} height={100} fill="url(#sbSliderThumb)" />
            </Svg>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
