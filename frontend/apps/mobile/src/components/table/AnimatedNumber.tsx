/**
 * Reanimated-driven numeric text — the native replacement for the PWA
 * rAF `useAnimatedCounter` (PotBadge, PlayerSpot stack, AnalyticsPanel).
 *
 * The count runs entirely on the UI thread: a shared value tweens
 * from → to with the PWA's 500ms ease-out-cubic, and a derived string
 * feeds an invisible `TextInput` via `useAnimatedProps` (the standard
 * zero-JS-per-frame text animation pattern). Falls back to static text
 * while `from`/`to` are identical.
 */
import { useEffect } from 'react';
import { type StyleProp, TextInput, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface AnimatedNumberProps {
  value: number;
  /** Tween duration in ms (PWA default 500). */
  duration?: number;
  /** Format the animated number into display text. */
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
}

export function AnimatedNumber({
  value,
  duration = 500,
  format = (n) => Math.round(n).toString(),
  style,
}: AnimatedNumberProps) {
  const progress = useSharedValue(0);
  const from = useSharedValue(value);
  const to = useSharedValue(value);

  useEffect(() => {
    from.value = to.value;
    to.value = value;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration,
      easing: Easing.out((p) => 1 - (1 - p) ** 3),
    });
  }, [value, duration, from, to, progress]);

  const display = useDerivedValue(() => {
    const eased = progress.value;
    return format(from.value + (to.value - from.value) * eased);
  });

  const animatedProps = useAnimatedProps(() => ({
    text: display.value,
    // Native TextInput needs a non-animated defaultValue placeholder; the
    // animated `text` prop overrides it on the UI thread.
    defaultValue: display.value,
  }));

  return (
    <AnimatedTextInput
      editable={false}
      allowFontScaling={false}
      animatedProps={animatedProps}
      style={[{ minWidth: 1, padding: 0 }, style]}
    />
  );
}
