import { type ReactNode, useCallback } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motionPresets } from '../motion/presets';

export interface PressableScaleProps {
  children?: ReactNode;
  onPress?: () => void;
  /** Target scale while pressed (default 0.97). */
  scale?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Press feedback wrapper — Pressable + Reanimated spring scale (0.97,
 * stiffness 300 / damping 20). The standard touch equivalent of the PWA
 * `whileHover: {y: -4}` / `whileTap: {scale: 0.97}` interactions.
 */
export function PressableScale({
  children,
  onPress,
  scale = motionPresets.pressScale,
  disabled = false,
  style,
}: PressableScaleProps) {
  const scaleValue = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scaleValue.value = withSpring(scale, motionPresets.pressSpring);
  }, [scale, scaleValue]);

  const handlePressOut = useCallback(() => {
    scaleValue.value = withSpring(1, motionPresets.pressSpring);
  }, [scaleValue]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={style}
    >
      <Animated.View style={animStyle}>{children}</Animated.View>
    </Pressable>
  );
}
