import { useCallback, useEffect, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import { motionPresets } from '../motion/presets';
import { card, cardExtras, colors } from '../tokens';

const GLOW_LOOP_HALF_MS = motionPresets.cardWinGlow.loopMs / 2;

function useCardWidth(fixedWidth?: number) {
  const [measured, setMeasured] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setMeasured((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
  }, []);
  return { width: fixedWidth ?? measured, onLayout };
}

/**
 * Card back face — dark 135° gradient, white/30 border, inset 10% inner
 * border, repeating 45° emerald line pattern (SVG pattern) at layer opacity
 * 0.10, and white/15 corner brackets. Values from PWA Card.tsx renderBack().
 */
export function CardBackFace({
  width,
  height,
  rounded,
}: {
  width: number;
  height: number;
  rounded: number;
}) {
  if (width <= 0 || height <= 0) return null;
  const inset = width * card.paddingRatio;

  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        borderRadius: rounded,
        borderWidth: 1,
        borderColor: card.backBorderColor,
        overflow: 'hidden',
        backgroundColor: card.backBackground[0],
      }}
    >
      <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          {/* CSS linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%) */}
          <LinearGradient id="sbCardBackGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={card.backBackground[0]} />
            <Stop offset="1" stopColor={card.backBackground[1]} />
          </LinearGradient>
          {/* repeating-linear-gradient(45deg, transparent 2px, rgba(78,222,163,0.15) 2px 4px) */}
          <Pattern
            id="sbCardBackPattern"
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Rect x={0} y={0} width={2} height={6} fill={card.backPatternColor} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#sbCardBackGradient)" />
        <Rect width="100%" height="100%" fill="url(#sbCardBackPattern)" opacity={0.1} />
      </Svg>

      {/* inset-[10%] inner border */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          borderRadius: rounded * 0.75,
          borderWidth: 1,
          borderColor: cardExtras.backInnerBorder,
        }}
      />
      {/* corner brackets */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: inset,
          left: inset,
          width: inset,
          height: inset,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderTopLeftRadius: rounded * 0.6,
          borderColor: cardExtras.backBracket,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: inset,
          right: inset,
          width: inset,
          height: inset,
          borderBottomWidth: 1,
          borderRightWidth: 1,
          borderBottomRightRadius: rounded * 0.6,
          borderColor: cardExtras.backBracket,
        }}
      />
    </View>
  );
}

function CardFace({
  width,
  height,
  rounded,
  rank,
  suit,
  bottomEdge,
}: {
  width: number;
  height: number;
  rounded: number;
  rank?: string;
  suit?: string;
  bottomEdge?: boolean;
}) {
  if (width <= 0 || height <= 0) return null;
  const isRed = suit === '♥' || suit === '♦';
  const suitColor = isRed ? colors.suitRed : colors.suitDark;
  const padding = width * card.paddingRatio;

  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        borderRadius: rounded,
        backgroundColor: card.frontBackground,
        overflow: 'hidden',
      }}
    >
      {/* Corner rank + suit (25cqw / 20cqw) */}
      <View style={{ position: 'absolute', top: 0, left: 0, padding, alignItems: 'center' }}>
        <Text
          allowFontScaling={false}
          style={{
            color: suitColor,
            fontSize: width * card.cornerRankRatio,
            lineHeight: width * card.cornerRankRatio,
            fontWeight: '700',
            includeFontPadding: false,
          }}
        >
          {rank}
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            color: suitColor,
            fontSize: width * card.cornerSuitRatio,
            lineHeight: width * card.cornerSuitRatio,
            fontWeight: '700',
            includeFontPadding: false,
          }}
        >
          {suit}
        </Text>
      </View>

      {/* Center suit — 55cqw anchored at bottom 10% */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: padding, alignItems: 'center' }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: suitColor,
            fontSize: width * card.centerSuitRatio,
            lineHeight: width * card.centerSuitRatio,
            includeFontPadding: false,
          }}
        >
          {suit}
        </Text>
      </View>

      {/* Community-card bottom edge (PWA `border-b-4 border-gray-200`) */}
      {bottomEdge && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: cardExtras.bottomEdgeHeight,
            backgroundColor: cardExtras.bottomEdge,
          }}
        />
      )}
    </View>
  );
}

export interface NativeCardProps {
  /** Rank glyph, e.g. 'A', '10', 'K'. */
  rank?: string;
  /** Suit glyph, e.g. '♠' '♥' '♦' '♣'. */
  suit?: string;
  /** Render the dark patterned back instead of the face. */
  faceDown?: boolean;
  /** Fixed width in px; when omitted the card self-measures (cqw port). */
  width?: number;
  /** Showdown winner: looping emerald glow halo (3s easeInOut). */
  isWinning?: boolean;
  /** Showdown loser: dimmed + dark overlay + scale 0.98. */
  isLosing?: boolean;
  /** Enable press scale feedback (0.97, spring 300). */
  pressable?: boolean;
  /** Community-card style 4px bottom edge. */
  bottomEdge?: boolean;
  /** Corner radius in px (PWA rounded-sm). */
  rounded?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Playing card — React Native port of PWA `components/game/Card.tsx`.
 *
 * The PWA sizes card typography with container queries (cqw); here the card
 * self-measures its width via `onLayout` (or takes an explicit `width`) and
 * derives font sizes as width×0.25 (rank), ×0.20 (corner suit), ×0.55
 * (center suit). Winning glow is an animated-opacity emerald halo (RN cannot
 * animate box-shadow); losing state dims via opacity + dark overlay
 * (grayscale filter is not available on RN — see worklog deviations).
 */
export function NativeCard({
  rank,
  suit,
  faceDown = false,
  width: fixedWidth,
  isWinning = false,
  isLosing = false,
  pressable = false,
  bottomEdge = false,
  rounded = 4,
  onPress,
  style,
}: NativeCardProps) {
  const { width, onLayout } = useCardWidth(fixedWidth);
  const height = width / card.aspectRatio;

  const pressScale = useSharedValue(1);
  const loseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(isWinning ? motionPresets.cardWinGlow.glowLow : 0);

  useEffect(() => {
    if (isWinning) {
      glowOpacity.value = withRepeat(
        withTiming(motionPresets.cardWinGlow.glowHigh, {
          duration: GLOW_LOOP_HALF_MS,
          easing: motionPresets.cardWinGlow.easing,
        }),
        -1,
        true,
      );
    } else {
      cancelAnimation(glowOpacity);
      glowOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isWinning, glowOpacity]);

  useEffect(() => {
    if (isLosing) {
      loseScale.value = withTiming(motionPresets.cardLose.scale, {
        duration: motionPresets.cardLose.durationMs,
        easing: motionPresets.cardLose.easing,
      });
    } else {
      loseScale.value = withTiming(1, { duration: 150 });
    }
  }, [isLosing, loseScale]);

  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: isLosing ? cardExtras.losingOpacity : 1,
    transform: [{ scale: loseScale.value * pressScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(motionPresets.pressScale, motionPresets.pressSpring);
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, motionPresets.pressSpring);
  }, [pressScale]);

  return (
    <Pressable
      onPress={pressable ? onPress : undefined}
      onPressIn={pressable ? handlePressIn : undefined}
      onPressOut={pressable ? handlePressOut : undefined}
      disabled={!pressable}
      style={style}
    >
      <Animated.View
        onLayout={onLayout}
        style={[
          {
            aspectRatio: card.aspectRatio,
            borderRadius: rounded,
            overflow: 'visible',
            // baseShadow '0 4px 12px rgba(0,0,0,0.5)' approximation
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isLosing ? 0.7 : 0.5,
            shadowRadius: isLosing ? 8 : 12,
            elevation: isLosing ? 6 : 8,
          },
          wrapperStyle,
        ]}
      >
        {/* Winning glow halo — animated opacity stands in for box-shadow loop */}
        {isWinning && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: -6,
                left: -6,
                right: -6,
                bottom: -6,
                borderRadius: rounded + 6,
                borderWidth: cardExtras.winGlowHaloWidth,
                borderColor: colors.accent,
              },
              glowStyle,
            ]}
          />
        )}

        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: rounded,
            overflow: 'hidden',
          }}
        >
          {faceDown ? (
            <CardBackFace width={width} height={height} rounded={rounded} />
          ) : (
            <CardFace
              width={width}
              height={height}
              rounded={rounded}
              rank={rank}
              suit={suit}
              bottomEdge={bottomEdge}
            />
          )}

          {/* Losing brightness(0.5) emulation */}
          {isLosing && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: rounded,
                backgroundColor: cardExtras.losingOverlay,
              }}
            />
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export interface CardBackProps {
  /** Fixed width in px; self-measures when omitted. */
  width?: number;
  /** Corner radius in px (PWA rounded-sm). */
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}

/** Standalone face-down card (port of PWA `CardBack`). */
export function CardBack({ width, rounded = 4, style }: CardBackProps) {
  const { width: w, onLayout } = useCardWidth(width);
  const height = w / card.aspectRatio;

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          aspectRatio: card.aspectRatio,
          borderRadius: rounded,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 12,
          elevation: 8,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, borderRadius: rounded, overflow: 'hidden' }}>
        <CardBackFace width={w} height={height} rounded={rounded} />
      </View>
    </View>
  );
}
