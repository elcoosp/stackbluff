/**
 * PlayerSpot — native port of PWA `components/game/PlayerSpot.tsx` (34KB).
 *
 * Glass hub (avatar / name / bot / rank tier / position badge / animated
 * stack / VPIP-PFR-AF stats row), live timer bar, hole-card group with
 * 3D flip + collapse/fan + per-card win/lose states, dealer button with
 * shine sweep, action badge with per-action spring variants, winner
 * overlay (glow / expanding ring / spinning diamond / sparkles / sweep),
 * all-in glow, fold & showdown dimming, sitting-out kick button, hand
 * description pill, and a long-press stats peek (gesture-handler).
 *
 * Every counter is a Reanimated shared value (the PWA used rAF).
 */

import type { Seat } from '@stackbluff/shared/src/stores/gameStore';
import type { Position } from '@stackbluff/ui-native';
import { NativeCard, PlayerAvatar, PlayerSpotBadge, RankTierBadge } from '@stackbluff/ui-native';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedNumber } from './AnimatedNumber';
import { formatStack } from './format';
import { XIcon } from './icons';
import { LiveTimerBar } from './LiveTimerBar';

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/* ── Action badge styling (PWA getActionStyles) ─────────────────────────── */
const ACTION_STYLE: Record<
  string,
  { color: string; icon: 'fold' | 'check' | 'call' | 'raise' | 'allin' | null }
> = {
  FOLD: { color: 'rgba(248, 113, 113, 1)', icon: 'fold' },
  CHECK: { color: 'rgba(78, 222, 163, 1)', icon: 'check' },
  CALL: { color: 'rgba(78, 222, 163, 1)', icon: 'call' },
  BET: { color: 'rgba(255, 255, 255, 0.85)', icon: 'raise' },
  RAISE: { color: 'rgba(255, 255, 255, 0.85)', icon: 'raise' },
  'ALL-IN': { color: 'rgba(251, 191, 36, 1)', icon: 'allin' },
};

function actionColor(text?: string): string {
  return ACTION_STYLE[text ?? '']?.color ?? 'rgba(78, 222, 163, 1)';
}

/* ── Tiny inline glyphs for the action badge (check/fold/call/raise/allin) ─ */
function BadgeGlyph({ kind, color }: { kind: string | null; color: string }) {
  if (!kind) return null;
  return (
    <Animated.View style={{ opacity: 0.95 }}>
      {kind === 'check' && <Text style={{ color, fontSize: 9, fontWeight: '900' }}>✓</Text>}
      {kind === 'fold' && <Text style={{ color, fontSize: 9, fontWeight: '900' }}>↩</Text>}
      {kind === 'call' && <Text style={{ color, fontSize: 9, fontWeight: '900' }}>$</Text>}
      {kind === 'raise' && <Text style={{ color, fontSize: 9, fontWeight: '900' }}>↗</Text>}
      {kind === 'allin' && <Text style={{ color, fontSize: 9, fontWeight: '900' }}>⚔</Text>}
    </Animated.View>
  );
}

/* ── Winner overlay — full PWA layer set on the UI thread ───────────────── */
const WINNER_SPARKLES = [
  { x: 15, y: 25, delay: 0.1, dx: 8, dy: -6, scaleZ: 0.8 },
  { x: 75, y: 20, delay: 0.6, dx: -10, dy: 5, scaleZ: 1.2 },
  { x: 10, y: 70, delay: 1.1, dx: 6, dy: 8, scaleZ: 0.9 },
  { x: 82, y: 78, delay: 1.6, dx: -5, dy: -9, scaleZ: 1.1 },
  { x: 45, y: 12, delay: 0.3, dx: -7, dy: 4, scaleZ: 1.0 },
  { x: 55, y: 85, delay: 0.9, dx: 9, dy: -3, scaleZ: 0.7 },
];

const WinnerOverlay = memo(function WinnerOverlay() {
  const glowOpacity = useSharedValue(0.3);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.8);
  const diamondOpacity = useSharedValue(0);
  const diamondScale = useSharedValue(0.8);
  const diamondSpin = useSharedValue(0);
  const sweepX = useSharedValue(-120);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      2,
      false,
    );
    ringScale.value = withDelay(
      200,
      withTiming(1.15, { duration: 1800, easing: Easing.out(Easing.ease) }),
    );
    ringOpacity.value = withDelay(200, withTiming(0, { duration: 1800 }));
    diamondOpacity.value = withSequence(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
    );
    diamondScale.value = withSequence(
      withTiming(1.2, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
    );
    diamondSpin.value = withTiming(360, { duration: 4000, easing: Easing.inOut(Easing.ease) });
    sweepX.value = withTiming(120, { duration: 2800, easing: Easing.inOut(Easing.ease) });
  }, [glowOpacity, ringScale, ringOpacity, diamondOpacity, diamondScale, diamondSpin, sweepX]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const diamondStyle = useAnimatedStyle(() => ({
    opacity: diamondOpacity.value,
    transform: [
      { rotate: '45deg' },
      { rotateX: `${diamondSpin.value}deg` },
      { rotateY: `${diamondSpin.value / 2}deg` },
      { scale: diamondScale.value },
    ],
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${sweepX.value}%` }],
  }));

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        borderRadius: 4,
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 4,
            backgroundColor: 'rgba(78,222,163,0.16)',
          },
          glowStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: 'rgba(78,222,163,0.6)',
          },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 40,
            height: 40,
            marginLeft: -20,
            marginTop: -20,
            borderWidth: 1.5,
            borderColor: 'rgba(78,222,163,0.5)',
            backgroundColor: 'rgba(78,222,163,0.08)',
          },
          diamondStyle,
        ]}
      />
      {WINNER_SPARKLES.map((s) => (
        <Sparkle key={s.x} sparkle={s} />
      ))}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '-35%',
            width: '70%',
            backgroundColor: 'rgba(78,222,163,0.12)',
          },
          sweepStyle,
        ]}
      />
    </View>
  );
});

function Sparkle({
  sparkle: s,
}: {
  sparkle: { x: number; y: number; delay: number; dx: number; dy: number; scaleZ: number };
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    x.value = withDelay(
      s.delay * 1000,
      withSequence(
        withTiming(s.dx, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
      ),
    );
    y.value = withDelay(
      s.delay * 1000,
      withSequence(
        withTiming(s.dy, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
      ),
    );
    scale.value = withDelay(
      s.delay * 1000,
      withSequence(
        withTiming(1.8 * s.scaleZ, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
      ),
    );
    opacity.value = withDelay(
      s.delay * 1000,
      withSequence(
        withTiming(1, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
      ),
    );
  }, [s, x, y, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#4EDEA3',
        },
        style,
      ]}
    />
  );
}

/* ── Hole-card group — collapse/fan + 3D flip + win/lose ─────────────────── */
interface HoleCard {
  rank: string;
  suit: string;
}

function FlipCard({
  holeCard,
  showFaceUp,
  width,
  delayMs,
  isWinning,
  isLosing,
  isWinningActive,
}: {
  holeCard?: HoleCard;
  showFaceUp: boolean;
  width: number;
  delayMs: number;
  isWinning: boolean;
  isLosing: boolean;
  isWinningActive: boolean;
}) {
  const rotateY = useSharedValue(showFaceUp ? -90 : 90);

  useEffect(() => {
    rotateY.value = showFaceUp ? -90 : 90;
    rotateY.value = withDelay(
      delayMs,
      withTiming(0, { duration: 450, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
    );
  }, [showFaceUp, delayMs, rotateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotateY.value}deg` }],
  }));

  const height = width * 1.4;

  return (
    <Animated.View style={[{ width, height }, style]}>
      {holeCard && showFaceUp ? (
        <View style={{ width: '100%', height: '100%' }}>
          <SpotCard
            holeCard={holeCard}
            width={width}
            isWinning={isWinning && isWinningActive}
            isLosing={isLosing}
          />
        </View>
      ) : (
        <View style={{ width: '100%', height: '100%' }}>
          <SpotCard holeCard={undefined} width={width} isWinning={false} isLosing={false} />
        </View>
      )}
    </Animated.View>
  );
}

/** Wraps NativeCard at a fixed pixel width (self-measure cqw port). */
function SpotCard({
  holeCard,
  width,
  isWinning,
  isLosing,
}: {
  holeCard?: HoleCard;
  width: number;
  isWinning: boolean;
  isLosing: boolean;
}) {
  if (!holeCard) {
    // CardBack is rendered through NativeCard faceDown for identical shadows.
    return <NativeCard width={width} faceDown rounded={4} />;
  }
  return (
    <NativeCard
      width={width}
      rank={holeCard.rank}
      suit={holeCard.suit}
      rounded={4}
      isWinning={isWinning}
      isLosing={isLosing}
    />
  );
}

function CardGroup({
  showCardsFaceUp,
  holeCards,
  cardWidth,
  isMobile,
  winningCards,
  isWinner,
  isShowdown,
  isHero,
  isDealing,
}: {
  showCardsFaceUp: boolean;
  holeCards?: HoleCard[];
  cardWidth: number;
  isMobile: boolean;
  winningCards?: HoleCard[];
  isWinner?: boolean;
  isShowdown?: boolean;
  isHero?: boolean;
  isDealing?: boolean;
}) {
  const [fanned, setFanned] = useState(false);
  if (isHero && isDealing) return null;

  const isWinningCard = (card?: HoleCard) =>
    !!card && (winningCards ?? []).some((wc) => wc.rank === card.rank && wc.suit === card.suit);

  const isCardLosing = (card?: HoleCard) => {
    if (!isShowdown) return false;
    if (isWinner) return !isWinningCard(card);
    return true;
  };

  const hasCards = (holeCards?.length ?? 0) > 0;

  return (
    <Pressable
      onPress={() => setFanned((p) => !p)}
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      {/* containerVariants gap 0 ↔ 4, 0.25s easeOut */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: fanned ? 4 : 0,
        }}
      >
        <FanCard side="left" fanned={fanned} isMobile={isMobile}>
          {hasCards ? (
            <FlipCard
              holeCard={holeCards?.[0]}
              showFaceUp={showCardsFaceUp}
              width={cardWidth}
              delayMs={0}
              isWinning={isWinningCard(holeCards?.[0])}
              isLosing={isCardLosing(holeCards?.[0])}
              isWinningActive={!!isWinner}
            />
          ) : (
            <SpotCard width={cardWidth} isWinning={false} isLosing={false} />
          )}
        </FanCard>
        <FanCard side="right" fanned={fanned} isMobile={isMobile}>
          {hasCards ? (
            <FlipCard
              holeCard={holeCards?.[1]}
              showFaceUp={showCardsFaceUp}
              width={cardWidth}
              delayMs={50}
              isWinning={isWinningCard(holeCards?.[1])}
              isLosing={isCardLosing(holeCards?.[1])}
              isWinningActive={!!isWinner}
            />
          ) : (
            <SpotCard width={cardWidth} isWinning={false} isLosing={false} />
          )}
        </FanCard>
      </View>
    </Pressable>
  );
}

/** leftCardVariants/rightCardVariants — collapse ↔ fan, 0.25s easeOut. */
function FanCard({
  side,
  fanned,
  isMobile,
  children,
}: {
  side: 'left' | 'right';
  fanned: boolean;
  isMobile: boolean;
  children: React.ReactNode;
}) {
  const rotate = useSharedValue(side === 'left' ? -6 : 6);
  const translateX = useSharedValue(0);

  useEffect(() => {
    const sign = side === 'left' ? -1 : 1;
    const collapsedX = side === 'left' ? (isMobile ? 4 : 6) : -(isMobile ? 4 : 6);
    const fanX = (isMobile ? -3 : -4) * (side === 'left' ? 1 : -1);
    rotate.value = withTiming(sign * (fanned ? 8 : 6), {
      duration: 250,
      easing: Easing.out(Easing.ease),
    });
    translateX.value = withTiming(fanned ? fanX : collapsedX, {
      duration: 250,
      easing: Easing.out(Easing.ease),
    });
  }, [fanned, side, isMobile, rotate, translateX]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }, { translateX: translateX.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/* ── Action badge entrance variants (PWA getActionBadgeVariants) ─────────── */
function useBadgeEntrance(text?: string) {
  const opacity = useSharedValue(0);
  const y = useSharedValue(0);
  const x = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotate = useSharedValue('0deg');

  useEffect(() => {
    opacity.value = 0;
    switch (text) {
      case 'FOLD':
        y.value = -15;
        scale.value = 0.5;
        rotate.value = '-10deg';
        opacity.value = withTiming(1, { duration: 120 });
        y.value = withSpring(0, { stiffness: 300, damping: 20 });
        scale.value = withSpring(1, { stiffness: 300, damping: 20 });
        rotate.value = withSpring('0deg', { stiffness: 300, damping: 20 });
        break;
      case 'CHECK':
        y.value = 10;
        scale.value = 0.8;
        opacity.value = withTiming(1, { duration: 100 });
        y.value = withSpring(0, { stiffness: 400, damping: 15 });
        scale.value = withSpring(1, { stiffness: 400, damping: 15 });
        break;
      case 'CALL':
        x.value = -20;
        scale.value = 0.8;
        opacity.value = withTiming(1, { duration: 100 });
        x.value = withSpring(0, { stiffness: 300, damping: 20 });
        scale.value = withSpring(1, { stiffness: 300, damping: 20 });
        break;
      case 'BET':
      case 'RAISE':
        y.value = 15;
        scale.value = 0.5;
        opacity.value = withTiming(1, { duration: 100 });
        y.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) });
        scale.value = withSequence(
          withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
          withTiming(1.1, { duration: 100, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 100, easing: Easing.inOut(Easing.ease) }),
        );
        break;
      case 'ALL-IN':
        scale.value = 0.2;
        opacity.value = withTiming(1, { duration: 100 });
        scale.value = withSequence(
          withTiming(1, { duration: 200, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
          withTiming(1.2, { duration: 100, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 100, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
        );
        break;
      default:
        scale.value = 0.6;
        opacity.value = withTiming(1, { duration: 100 });
        scale.value = withSpring(1, { stiffness: 500, damping: 30 });
    }
  }, [text, opacity, y, x, scale, rotate]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: y.value },
      { translateX: x.value },
      { scale: scale.value },
      { rotate: rotate.value },
    ],
  }));
}

/* ── Main component ──────────────────────────────────────────────────────── */
export interface PlayerSpotProps {
  seat: Seat;
  isHero?: boolean;
  isMobile?: boolean;
  isDealer?: boolean;
  seatPosition?: Position;
  /** Container (viewport) width — hub sizing + vw widths. */
  containerWidth: number;
  /** UI-thread countdown for the acting seat (null → no timer). */
  timerProgress?: SharedValue<number> | null;
  isDealing?: boolean;
  onShowStats?: (userId: string) => void;
  onKick?: (userId: string) => void;
}

export const PlayerSpot = memo(function PlayerSpot({
  seat,
  isHero = false,
  isMobile = false,
  isDealer = false,
  seatPosition,
  containerWidth,
  timerProgress,
  isDealing = false,
  onShowStats,
  onKick,
}: PlayerSpotProps) {
  const {
    display_name = seat.user_id?.slice(0, 8) || 'Player',
    is_bot,
    stack,
    current_bet,
    is_all_in,
    is_folded,
    is_active,
    avatar_url,
    position_badge,
    action,
    hole_cards,
    winning_cards,
    is_winner,
    is_showdown_revealed,
    stats,
    rank_tier,
  } = seat;

  const isActive = is_active && !is_folded && !is_all_in;
  const isFolded = is_folded;
  const isLosingPlayer = is_showdown_revealed && !is_winner;

  const showCardsFaceUp = !!(isHero || (is_showdown_revealed && (hole_cards?.length ?? 0) > 0));
  const isLargeCards = isHero || showCardsFaceUp;

  // Hub sizing (PWA w-[40vw]/w-[26vw] + max widths)
  const hubWidth = useMemo(() => {
    if (isHero) return isMobile ? Math.min(containerWidth * 0.4, 140) : 160;
    return isMobile ? Math.min(containerWidth * 0.26, 100) : 120;
  }, [isHero, isMobile, containerWidth]);
  const hubPadding = isHero ? (isMobile ? 8 : 10) : isMobile ? 4 : 6;
  const cardWidth = isLargeCards ? 48 : isMobile ? 16 : 28;

  const cardYOffset = (() => {
    if (isHero) return -56;
    if (showCardsFaceUp) return isMobile ? -54 : -56;
    return isMobile ? -20 : -34;
  })();

  const isLeftSide = seatPosition ? Number.parseFloat(seatPosition.left) < 40 : false;

  /* Winner hub wobble + glow (PWA scale [1,1.03,1] rotateX/Y, 2.5s ×2) */
  const winScale = useSharedValue(1);
  const winRotX = useSharedValue(0);
  const winRotY = useSharedValue(0);
  useEffect(() => {
    if (is_winner) {
      winScale.value = withSequence(
        withTiming(1, { duration: 833, easing: EASE_OUT }),
        withTiming(1.03, { duration: 417, easing: EASE_OUT }),
        withTiming(1, { duration: 417, easing: EASE_OUT }),
        withTiming(1.03, { duration: 417, easing: EASE_OUT }),
        withTiming(1, { duration: 416, easing: EASE_OUT }),
      );
      winRotX.value = withSequence(
        withTiming(2, { duration: 1250, easing: EASE_OUT }),
        withTiming(0, { duration: 1250, easing: EASE_OUT }),
      );
      winRotY.value = withSequence(
        withTiming(-3, { duration: 1250, easing: EASE_OUT }),
        withTiming(0, { duration: 1250, easing: EASE_OUT }),
      );
    } else {
      winScale.value = withTiming(1, { duration: 600, easing: EASE_OUT });
      winRotX.value = withTiming(0, { duration: 600, easing: EASE_OUT });
      winRotY.value = withTiming(0, { duration: 600, easing: EASE_OUT });
    }
  }, [is_winner, winScale, winRotX, winRotY]);

  const hubAnim = useAnimatedStyle(() => ({
    transform: [
      { scale: winScale.value },
      { rotateX: `${winRotX.value}deg` },
      { rotateY: `${winRotY.value}deg` },
    ],
  }));
  /* All-in glow (opacity [0.3, 0.7, 0.3] 0.8s ×2) */
  const allInOpacity = useSharedValue(0);
  useEffect(() => {
    if (is_all_in && !is_folded) {
      allInOpacity.value = withSequence(
        withTiming(0.7, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.7, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      );
    } else {
      allInOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [is_all_in, is_folded, allInOpacity]);

  const allInStyle = useAnimatedStyle(() => ({ opacity: allInOpacity.value }));

  /* Card area mount animation (opacity/scale/y per PWA) */
  const cardAreaOpacity = useSharedValue(0);
  const cardAreaScale = useSharedValue(0.85);
  useEffect(() => {
    if (isDealing || isFolded) return;
    cardAreaOpacity.value = withTiming(1, { duration: 450, easing: EASE_OUT });
    cardAreaScale.value = withTiming(1, { duration: 450, easing: EASE_OUT });
  }, [isDealing, isFolded, cardAreaOpacity, cardAreaScale]);
  const cardAreaStyle = useAnimatedStyle(() => ({
    opacity: cardAreaOpacity.value,
    transform: [{ scale: cardAreaScale.value }],
  }));

  /* Stats flash colors (PWA L-6 logic) */
  const rawVpip = stats?.vpip ?? 0;
  const rawPfr = stats?.pfr ?? 0;
  const rawAf = stats?.aggression_factor ?? 0;
  const prevStatsRef = useRef({ vpip: rawVpip, pfr: rawPfr, af: rawAf });
  const [flashColors, setFlashColors] = useState<{ vpip?: string; pfr?: string; af?: string }>({});

  useEffect(() => {
    const prev = prevStatsRef.current;
    const updates: typeof flashColors = {};
    if (rawVpip !== prev.vpip) updates.vpip = rawVpip > prev.vpip ? '#4ade80' : '#f87171';
    if (rawPfr !== prev.pfr) updates.pfr = rawPfr > prev.pfr ? '#4ade80' : '#f87171';
    if (rawAf !== prev.af) updates.af = rawAf > prev.af ? '#4ade80' : '#f87171';
    prevStatsRef.current = { vpip: rawVpip, pfr: rawPfr, af: rawAf };
    if (Object.keys(updates).length > 0) {
      setFlashColors(updates);
      const timer = setTimeout(() => setFlashColors({}), 1500);
      return () => clearTimeout(timer);
    }
  }, [rawVpip, rawPfr, rawAf]);

  /* Timer mount animation */
  const timerOpacity = useSharedValue(timerProgress ? 1 : 0);
  useEffect(() => {
    timerOpacity.value = withTiming(timerProgress ? 1 : 0, {
      duration: 250,
      easing: EASE_OUT,
    });
  }, [timerProgress, timerOpacity]);

  const timerStyle = useAnimatedStyle(() => ({
    opacity: timerOpacity.value,
    marginTop: interpolate(timerOpacity.value, [0, 1], [0, isMobile ? 2 : 6]),
  }));

  /* Long-press stats peek */
  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        // RN gesture-handler API: `minDuration` (the PWA's `minDurationMs` is
        // the DOM-press flavor).
        .minDuration(350)
        .onStart(() => {
          if (onShowStats) onShowStats(seat.user_id);
        }),
    [onShowStats, seat.user_id],
  );

  const showActionBadge = (!!action || current_bet > 0) && !seat.is_showdown_revealed;
  const badgeStyle = useBadgeEntrance(action?.text);
  const infoColor = actionColor(action?.text);

  const dimLevel = isFolded ? 0.3 : isLosingPlayer ? 0.5 : 1;

  return (
    <GestureDetector gesture={longPress}>
      <View
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          // RN: perspective lives in the transform array, not the style root.
          transform: [{ perspective: 1000 }],
        }}
      >
        {/* Glass hub */}
        <Animated.View
          style={[
            {
              width: hubWidth,
              padding: hubPadding,
              borderRadius: 4,
              backgroundColor: 'rgba(8,8,8,0.85)',
              borderWidth: 1,
              borderColor: is_winner
                ? 'rgba(78,222,163,0.7)'
                : isActive
                  ? isHero
                    ? 'rgba(78,222,163,0.6)'
                    : 'rgba(78,222,163,0.4)'
                  : 'rgba(255,255,255,0.1)',
              shadowColor: '#4edea3',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: is_winner ? 0.35 : isActive ? 0.15 : 0,
              shadowRadius: is_winner ? 30 : isHero && isActive ? 25 : 20,
              elevation: is_winner ? 10 : isActive ? 6 : 0,
              opacity: dimLevel,
            },
            hubAnim,
          ]}
        >
          {is_winner && <WinnerOverlay />}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 4,
                backgroundColor: 'rgba(239,68,68,0.25)',
              },
              allInStyle,
            ]}
          />
          {(isFolded || isLosingPlayer) && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 4,
                backgroundColor: 'rgba(0,0,0,0.45)',
              }}
            />
          )}

          <View style={{ width: '100%', gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
              {!isMobile && (
                <PlayerAvatar
                  name={display_name}
                  avatarUrl={avatar_url}
                  isActive={isActive}
                  size={isMobile ? 16 : 32}
                />
              )}
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    allowFontScaling={false}
                    style={{
                      color: '#e2e2e2',
                      fontSize: 11,
                      fontWeight: '500',
                      opacity: isFolded ? 0.6 : 1,
                    }}
                  >
                    {display_name}
                  </Text>
                  {is_bot && (
                    <View
                      style={{
                        height: 14,
                        paddingHorizontal: 4,
                        borderRadius: 3,
                        backgroundColor: 'rgba(96,165,250,0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(96,165,250,0.3)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text allowFontScaling={false} style={{ fontSize: isMobile ? 6 : 7 }}>
                        🤖
                      </Text>
                    </View>
                  )}
                  {rank_tier && <RankTierBadge tier={rank_tier} size="sm" showLabel={false} />}
                  <PlayerSpotBadge userId={seat.user_id} showBadges />
                  {position_badge && (
                    <View
                      style={{
                        height: 16,
                        paddingHorizontal: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(78,222,163,0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(78,222,163,0.3)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        allowFontScaling={false}
                        style={{
                          color: '#4edea3',
                          fontSize: isMobile ? 7 : 8,
                          fontWeight: '700',
                          textTransform: 'uppercase',
                        }}
                      >
                        {position_badge}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <AnimatedNumber
                    value={typeof stack === 'number' ? stack : 0}
                    duration={600}
                    format={(n) => formatStack(Math.round(n))}
                    style={{
                      color: '#d4d4d8',
                      fontSize: isMobile ? 10 : 11,
                      fontWeight: '700',
                      fontVariant: ['tabular-nums'],
                    }}
                  />
                </View>
                {stats && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      height: 8,
                      gap: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <Text
                      allowFontScaling={false}
                      style={{ fontSize: 7, color: 'rgba(199,198,203,0.7)' }}
                    >
                      V
                    </Text>
                    <Text
                      allowFontScaling={false}
                      style={{
                        fontSize: 7,
                        color: flashColors.vpip ?? '#c7c6cb',
                        minWidth: 14,
                        textAlign: 'right',
                      }}
                    >
                      {Math.round(rawVpip * 100)}
                    </Text>
                    <Text
                      allowFontScaling={false}
                      style={{ fontSize: 7, color: 'rgba(199,198,203,0.7)' }}
                    >
                      /P
                    </Text>
                    <Text
                      allowFontScaling={false}
                      style={{
                        fontSize: 7,
                        color: flashColors.pfr ?? '#c7c6cb',
                        minWidth: 14,
                        textAlign: 'right',
                      }}
                    >
                      {Math.round(rawPfr * 100)}
                    </Text>
                    <Text
                      allowFontScaling={false}
                      style={{ fontSize: 7, color: 'rgba(199,198,203,0.7)' }}
                    >
                      /A
                    </Text>
                    <Text
                      allowFontScaling={false}
                      style={{
                        fontSize: 7,
                        color: flashColors.af ?? '#c7c6cb',
                        minWidth: 18,
                        textAlign: 'right',
                      }}
                    >
                      {rawAf.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Live timer */}
          {timerProgress && (
            <Animated.View
              pointerEvents="none"
              style={[{ width: '100%', paddingHorizontal: 2, overflow: 'hidden' }, timerStyle]}
            >
              <LiveTimerBar progress={timerProgress} isActive />
            </Animated.View>
          )}
        </Animated.View>

        {/* Hole cards */}
        <Animated.View
          pointerEvents="box-none"
          style={[
            {
              position: 'absolute',
              zIndex: 40,
              top: 0,
              ...(isHero
                ? { right: isMobile ? -20 : -10 }
                : { left: '50%', transform: [{ translateX: '-50%' }] }),
            },
            cardAreaStyle,
          ]}
        >
          <View style={{ transform: [{ translateY: cardYOffset }] }}>
            <CardGroup
              showCardsFaceUp={showCardsFaceUp}
              holeCards={hole_cards}
              cardWidth={cardWidth}
              isMobile={isMobile}
              winningCards={winning_cards}
              isWinner={is_winner}
              isShowdown={is_showdown_revealed}
              isHero={isHero}
              isDealing={isDealing}
            />
          </View>
        </Animated.View>

        {/* Dealer button */}
        {isDealer && <DealerButton isMobile={isMobile} isLeftSide={isLeftSide} />}

        {/* Kick vote (sitting-out opponents) */}
        {!isHero && seat.sitting_out && onKick && (
          <Pressable
            onPress={() => onKick(seat.user_id)}
            hitSlop={6}
            style={{
              position: 'absolute',
              bottom: -4,
              right: 0,
              zIndex: 60,
              padding: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(239,68,68,0.2)',
            }}
            accessibilityLabel="Kick player"
          >
            <XIcon size={12} color="#fca5a5" />
          </Pressable>
        )}

        {/* Action / bet badge */}
        {showActionBadge && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              zIndex: 100,
              ...(isHero
                ? { left: 0, top: 0, transform: [{ translateX: '-50%' }, { translateY: '-50%' }] }
                : {
                    left: '50%',
                    bottom: -6,
                    transform: [{ translateX: '-50%' }, { translateY: '50%' }],
                  }),
            }}
          >
            <Animated.View
              key={`${action?.text ?? ''}-${current_bet}`}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  borderWidth: 1,
                  borderColor: `${infoColor}50`,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  elevation: 5,
                },
                badgeStyle,
              ]}
            >
              <BadgeGlyph kind={ACTION_STYLE[action?.text ?? '']?.icon ?? null} color={infoColor} />
              {action?.text && (
                <Text
                  allowFontScaling={false}
                  style={{
                    color: infoColor,
                    fontSize: isMobile ? 10 : 8,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                  }}
                >
                  {action.text}
                </Text>
              )}
              {!isFolded && current_bet > 0 && (
                <Text
                  allowFontScaling={false}
                  style={{
                    color: infoColor,
                    opacity: 0.8,
                    fontSize: isMobile ? 10 : 8,
                    fontWeight: '700',
                  }}
                >
                  ${current_bet}
                </Text>
              )}
            </Animated.View>
          </View>
        )}

        {/* Showdown hand description */}
        {seat.is_showdown_revealed && seat.hand_description && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -24,
              zIndex: 100,
              left: '50%',
              transform: [{ translateX: '-50%' }],
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
              backgroundColor: is_winner ? 'rgba(78,222,163,0.2)' : 'rgba(0,0,0,0.8)',
              borderWidth: 1,
              borderColor: is_winner ? 'rgba(78,222,163,0.4)' : 'rgba(255,255,255,0.05)',
              shadowColor: '#000000',
              shadowOpacity: 0.4,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            }}
          >
            <Text
              allowFontScaling={false}
              style={{
                color: is_winner ? '#4edea3' : '#c7c6cb',
                fontSize: 8,
                fontWeight: '600',
                textTransform: 'uppercase',
              }}
            >
              {seat.hand_description}
            </Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
});

/* ── Dealer button ───────────────────────────────────────────────────────── */
function DealerButton({ isMobile, isLeftSide }: { isMobile: boolean; isLeftSide: boolean }) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const sweepX = useSharedValue(-150);
  const sweepDelay = useRef(2000 + Math.random() * 4000).current;

  useEffect(() => {
    opacity.value = withSpring(1, { stiffness: 300, damping: 25 });
    scale.value = withSpring(1, { stiffness: 300, damping: 25 });
    const runSweep = () => {
      sweepX.value = -150;
      sweepX.value = withDelay(
        0,
        withTiming(150, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      );
    };
    runSweep();
    const interval = setInterval(runSweep, sweepDelay + 600);
    return () => clearInterval(interval);
  }, [opacity, scale, sweepX, sweepDelay]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${sweepX.value}%` }],
  }));

  const size = 20;
  const fontSize = isMobile ? 8 : 9;

  const sideStyle: ViewStyle = isLeftSide
    ? { right: isMobile ? -16 : -8 }
    : { left: isMobile ? -16 : -8 };

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          zIndex: 110,
          width: size,
          height: size,
          borderRadius: size / 2,
          bottom: isMobile ? -12 : -8,
          backgroundColor: '#f5f5f5',
          borderWidth: 1,
          borderColor: 'rgba(156,163,175,0.8)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.6,
          shadowRadius: 6,
          elevation: 5,
        },
        sideStyle,
        anim,
      ]}
    >
      <Text
        allowFontScaling={false}
        style={{ color: '#000000', fontSize, fontWeight: '700', zIndex: 10 }}
      >
        D
      </Text>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '-35%',
            width: '70%',
            backgroundColor: 'rgba(255,255,255,0.8)',
            transform: [{ skewX: '-20deg' }],
          },
          sweepStyle,
        ]}
      />
    </Animated.View>
  );
}
