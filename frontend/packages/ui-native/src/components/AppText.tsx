import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, fontSizes, fonts } from '../tokens';

export type AppTextVariant = 'display' | 'headline' | 'body' | 'data' | 'label';

const variantStyles: Record<AppTextVariant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: fontSizes.display, color: colors.onBackground },
  headline: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.headline,
    color: colors.onBackground,
  },
  body: { fontFamily: fonts.body, fontSize: fontSizes.body, color: colors.onBackground },
  data: { fontFamily: fonts.data, fontSize: fontSizes.data, color: colors.onBackground },
  label: {
    fontFamily: fonts.labelCaps,
    fontSize: fontSizes.label,
    color: colors.mutedForeground,
    letterSpacing: 1,
  },
};

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  color?: string;
  center?: boolean;
}

/** Typography primitive — PWA font ladder (Playfair Display / Inter / JetBrains Mono). */
export function AppText({ variant = 'body', color, center, style, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        variantStyles[variant],
        color != null ? { color } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
    />
  );
}
