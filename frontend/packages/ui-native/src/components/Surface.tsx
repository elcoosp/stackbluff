import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { colors, radii } from '../tokens';

export interface SurfaceProps {
  children?: ReactNode;
  /** 'card' → colors.card; 'elevated' → container-high + shadow; 'flat' → transparent. */
  variant?: 'card' | 'elevated' | 'flat';
  /** Corner radius in px (default tokens.radii.base = 8). */
  radius?: number;
  /** Draw the 1px outlineVariant border. */
  bordered?: boolean;
  /** Inner padding in px. */
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Themed surface container — the native equivalent of PWA Card/Panel
 * surfaces: card background, outline border, rounded corners, optional
 * elevation. Token-driven only.
 */
export function Surface({
  children,
  variant = 'card',
  radius = radii.base,
  bordered = true,
  padding,
  style,
}: SurfaceProps) {
  const isElevated = variant === 'elevated';

  return (
    <View
      style={[
        {
          borderRadius: radius,
          backgroundColor:
            variant === 'flat'
              ? 'transparent'
              : isElevated
                ? colors.surfaceContainerHigh
                : colors.card,
          borderWidth: bordered ? 1 : 0,
          borderColor: colors.border,
          padding,
        },
        isElevated && {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.6,
          shadowRadius: 24,
          elevation: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
