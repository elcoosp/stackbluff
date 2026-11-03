import { type ReactNode, useEffect } from 'react';
import { type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { motionPresets } from '../motion/presets';
import { badges, colors, fonts, rankTierColors } from '../tokens';

/* ── Badge ── */

export interface BadgeProps {
  children: ReactNode;
  /** 'dealer' (gold gradient) / 'co' (grey gradient) / default (primary tint). */
  variant?: 'dealer' | 'co';
  style?: StyleProp<ViewStyle>;
}

/**
 * Table role badge — port of PWA Badge.tsx: pill with gradient (dealer /
 * co) or primary tint, mono bold 10px label, gentle 2s float loop.
 */
export function Badge({ children, variant, style }: BadgeProps) {
  const y = useSharedValue(0);

  useEffect(() => {
    const half = motionPresets.pulseEmerald.loopMs / 2;
    y.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: half, easing: motionPresets.float.easing }),
        withTiming(0, { duration: half, easing: motionPresets.float.easing }),
      ),
      -1,
    );
  }, [y]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const isDealer = variant === 'dealer';
  const isCo = variant === 'co';
  const stops = isDealer ? badges.dealerGradient : badges.coGradient;
  const textColor = isDealer ? badges.dealerText : isCo ? badges.coText : colors.primary;

  return (
    <Animated.View
      style={[
        {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: isDealer || isCo ? stops[0] : badges.defaultBg,
        },
        animStyle,
        style,
      ]}
    >
      {(isDealer || isCo) && (
        <Svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0 }}
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <Defs>
            <LinearGradient
              id={isDealer ? 'sbBadgeDealer' : 'sbBadgeCo'}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <Stop offset="0" stopColor={stops[0]} />
              <Stop offset="1" stopColor={stops[1]} />
            </LinearGradient>
          </Defs>
          <Rect
            width={100}
            height={100}
            fill={`url(#${isDealer ? 'sbBadgeDealer' : 'sbBadgeCo'})`}
          />
        </Svg>
      )}
      <Text
        allowFontScaling={false}
        style={{
          color: textColor,
          fontFamily: fonts.data,
          fontSize: 10,
          fontWeight: '700',
          includeFontPadding: false,
        }}
      >
        {children}
      </Text>
    </Animated.View>
  );
}

/* ── RankTierBadge ── */

export type RankTier =
  | 'brick'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'maestro'
  | 'legend';

const RANK_CONFIG: Record<RankTier, { label: string; emoji: string }> = {
  brick: { label: 'Brick', emoji: '🧱' },
  bronze: { label: 'Bronze', emoji: '🥉' },
  silver: { label: 'Silver', emoji: '🥈' },
  gold: { label: 'Gold', emoji: '🥇' },
  platinum: { label: 'Platinum', emoji: '💿' },
  diamond: { label: 'Diamond', emoji: '💎' },
  maestro: { label: 'Maestro', emoji: '🎭' },
  legend: { label: 'Legend', emoji: '👑' },
};

export interface RankTierBadgeProps {
  tier: RankTier | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TIER_SIZES = {
  sm: { fontSize: 12, emojiSize: 14, padH: 8, padV: 2, gap: 4 },
  md: { fontSize: 14, emojiSize: 16, padH: 10, padV: 4, gap: 6 },
  lg: { fontSize: 16, emojiSize: 18, padH: 12, padV: 6, gap: 8 },
} as const;

/**
 * Ranked tier pill — port of PWA RankTierBadge (emoji + label, white/5 bg,
 * white/10 border). Returns null for unknown tiers, exactly like the PWA.
 */
export function RankTierBadge({ tier, size = 'md', showLabel = true, style }: RankTierBadgeProps) {
  const normalized = tier?.toLowerCase() as RankTier;
  const config = RANK_CONFIG[normalized];
  if (!config) return null;

  const s = TIER_SIZES[size];
  const color = rankTierColors[normalized];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: s.gap,
          paddingHorizontal: s.padH,
          paddingVertical: s.padV,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          backgroundColor: 'rgba(255,255,255,0.05)',
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text allowFontScaling={false} style={{ fontSize: s.emojiSize, includeFontPadding: false }}>
        {config.emoji}
      </Text>
      {showLabel && (
        <Text
          allowFontScaling={false}
          style={{
            color,
            fontSize: s.fontSize,
            fontWeight: '500',
            includeFontPadding: false,
          }}
        >
          {config.label}
        </Text>
      )}
    </View>
  );
}

/* ── PlayerSpotBadge ── */

export interface SpotBadge {
  badge_type: string;
}

export interface PlayerSpotBadgeProps {
  /** Kept for API parity with the PWA component; not used to fetch. */
  userId?: string;
  /** Pre-fetched badges (the native app fetches via shared hooks — A4). */
  badges?: SpotBadge[];
  showBadges?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Player spot distinction badge — presentational port of PWA
 * PlayerSpotBadge: renders the 👑 founding-member mark when the given badge
 * list contains `founding_member`. The PWA fetches badges internally; on
 * native the fetch belongs to the data layer (A4/A5), so this component is
 * pure (deviation noted in worklog).
 */
export function PlayerSpotBadge({
  userId: _userId,
  badges: spotBadges,
  showBadges = true,
  style,
}: PlayerSpotBadgeProps) {
  if (!showBadges) return null;
  const hasFoundingMember = (spotBadges ?? []).some((b) => b.badge_type === 'founding_member');
  if (!hasFoundingMember) return null;

  return (
    <Text allowFontScaling={false} style={[{ marginLeft: 4, fontSize: 12 }, style]}>
      👑
    </Text>
  );
}

/* ── RazorDivider ── */

export interface RazorDividerProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * 1px hairline fading at both ends (white/20 at center) — port of PWA
 * RazorDivider (`h-px bg-gradient-to-r from-transparent via-white/20
 * to-transparent my-2`).
 */
export function RazorDivider({ style }: RazorDividerProps) {
  return (
    <View style={[{ height: 1, marginVertical: 8 }, style]}>
      <Svg width="100%" height={1} preserveAspectRatio="none" viewBox="0 0 100 1">
        <Defs>
          <LinearGradient id="sbRazorDivider" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width={100} height={1} fill="url(#sbRazorDivider)" />
      </Svg>
    </View>
  );
}
