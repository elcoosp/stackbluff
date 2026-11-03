import { useEffect } from 'react';
import { Image, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { avatar, fonts } from '../tokens';

export interface PlayerAvatarProps {
  /** Player display name — initials fallback uses its first 2 glyphs. */
  name: string;
  /** Remote avatar URI; falls back to initials. */
  avatarUrl?: string;
  /** Active turn — scales to 1.05 (PWA parity). */
  isActive?: boolean;
  /** Diameter in px (PWA default w-10 h-10 = 40). */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Round avatar with emerald ring — port of PWA PlayerAvatar (border
 * tertiary/50 + ring-2 tertiary/20, scale 1.05 when active, initials
 * fallback from the first two glyphs of the name).
 */
export function PlayerAvatar({
  name,
  avatarUrl,
  isActive = false,
  size = 40,
  style,
}: PlayerAvatarProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withTiming(isActive ? 1.05 : 1, { duration: 200 });
  }, [isActive, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const initials = name.trim().slice(0, 2).toUpperCase();

  return (
    <Animated.View
      style={[
        {
          width: size + avatar.ringWidth * 4,
          height: size + avatar.ringWidth * 4,
          borderRadius: (size + avatar.ringWidth * 4) / 2,
          borderWidth: avatar.ringWidth,
          borderColor: avatar.ring,
          padding: avatar.ringWidth + 1,
        },
        animStyle,
        style,
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: avatar.border,
          overflow: 'hidden',
          backgroundColor: avatar.fallbackBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: '100%', height: '100%', opacity: avatar.imageOpacity }}
          />
        ) : (
          <Text
            allowFontScaling={false}
            style={{
              color: avatar.fallbackText,
              fontFamily: fonts.bodyBold,
              fontSize: Math.max(10, Math.round(size * 0.3)),
              includeFontPadding: false,
            }}
          >
            {initials}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}
