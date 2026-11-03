/**
 * CommunityCards — native port of PWA `components/game/CommunityCards.tsx`.
 *
 * 5 slots (3-row < 365px, 2-row < 768px, single row ≥ 768px), dashed
 * empty slots with next-street pulse, spring deal slide
 * (damping 18 / stiffness 380 / mass 0.8, y −80 mobile / −120 desktop),
 * staggered flop batch (0.1s), and a 0.32s rotateY flip after a
 * 0.28s slide + 0.12s pause (cubic-bezier(0.4, 0, 0.2, 1)) — all
 * Reanimated, zero JS per frame. Winning cards glow / losing cards dim
 * through NativeCard state props.
 */

import type { Card } from '@stackbluff/shared/src/stores/gameStore';
import { CardBack, NativeCard } from '@stackbluff/ui-native';
import { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { getCommunityCardMetrics } from './format';

export interface CommunityCardsProps {
  cards: Card[];
  /** PWA `windowWidth` equivalent — pass the table viewport width. */
  containerWidth: number;
  revealedCount?: number;
  winningCards?: Card[];
}

const SLIDE_DURATION_S = 0.28;
const PAUSE_S = 0.12;
const FLIP_DURATION_MS = 320;
const FLOP_STAGGER_S = 0.1;

const EmptySlot = memo(function EmptySlot({ isNextStreet }: { isNextStreet: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (isNextStreet) {
      opacity.value = withRepeat(
        withTiming(0.45, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      opacity.value = withTiming(0.15, { duration: 200 });
    }
  }, [isNextStreet, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 4,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: isNextStreet ? 'rgba(78,222,163,0.25)' : 'rgba(255,255,255,0.05)',
        backgroundColor: isNextStreet ? 'rgba(78,222,163,0.02)' : 'rgba(255,255,255,0.008)',
      }}
    >
      {isNextStreet && (
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
              backgroundColor: 'rgba(78,222,163,0.04)',
            },
            pulseStyle,
          ]}
        />
      )}
    </View>
  );
});

const exitKeyframeMobile = (slotIndex: number) =>
  new Keyframe([
    { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }, { rotate: '0deg' }] },
    {
      opacity: 0,
      transform: [
        { translateY: -150 },
        { scale: 0.8 },
        { rotate: slotIndex % 2 === 0 ? '15deg' : '-15deg' },
      ],
    },
  ]).duration(400);

const exitKeyframeDesktop = (slotIndex: number) =>
  new Keyframe([
    { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }, { rotate: '0deg' }] },
    {
      opacity: 0,
      transform: [
        { translateY: -200 },
        { scale: 0.8 },
        { rotate: slotIndex % 2 === 0 ? '15deg' : '-15deg' },
      ],
    },
  ]).duration(400);

function Slot({
  slotIndex,
  card,
  isDealt,
  revealedCount,
  prevCount,
  cardWidth,
  containerWidth,
  winningCards,
}: {
  slotIndex: number;
  card: Card | null;
  isDealt: boolean;
  revealedCount: number;
  prevCount: number;
  cardWidth: number;
  containerWidth: number;
  winningCards: Card[];
}) {
  const isMobile = containerWidth < 768;
  const cardHeight = cardWidth * 1.4; // frozen 5:7 aspect

  const numNewCards = Math.max(0, revealedCount - prevCount);
  const batchStart = Math.min(prevCount, revealedCount);
  const isInCurrentBatch = slotIndex >= batchStart && slotIndex < revealedCount;
  const dealDelayS =
    isInCurrentBatch && numNewCards > 1 ? (slotIndex - batchStart) * FLOP_STAGGER_S : 0;
  const flipDelayMs = (dealDelayS + SLIDE_DURATION_S + PAUSE_S) * 1000;

  // Enter (slide + spring) — shared values armed at mount.
  const translateY = useSharedValue(isMobile ? -80 : -120);
  const scale = useSharedValue(0.88);
  const opacity = useSharedValue(0);
  const rotateY = useSharedValue(0);

  useEffect(() => {
    if (!isDealt) return;
    translateY.value = isMobile ? -80 : -120;
    scale.value = 0.88;
    opacity.value = 0;
    rotateY.value = 0;
    translateY.value = withDelay(
      dealDelayS * 1000,
      withTiming(0, {
        duration: 500,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      }),
    );
    scale.value = withDelay(
      dealDelayS * 1000,
      withSpring(1, { damping: 18, stiffness: 380, mass: 0.8 }),
    );
    opacity.value = withDelay(dealDelayS * 1000, withTiming(1, { duration: 150 }));
    rotateY.value = withDelay(
      flipDelayMs,
      withTiming(-180, {
        duration: FLIP_DURATION_MS,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }),
    );
  }, [isDealt, dealDelayS, flipDelayMs, isMobile, translateY, scale, opacity, rotateY]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const flipStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotateY.value}deg` }],
  }));

  const isNextStreet =
    (revealedCount === 0 && slotIndex < 3) ||
    (revealedCount === 3 && slotIndex === 3) ||
    (revealedCount === 4 && slotIndex === 4);

  const isWinning = (c: Card | null) =>
    !!c && winningCards.some((wc) => wc.rank === c.rank && wc.suit === c.suit);

  return (
    <View
      style={{
        width: cardWidth,
        height: cardHeight,
        // RN: perspective lives in the transform array, not the style root.
        transform: [{ perspective: 700 }],
      }}
    >
      {!isDealt && <EmptySlot isNextStreet={isNextStreet} />}

      {isDealt && card && (
        <Animated.View
          exiting={isMobile ? exitKeyframeMobile(slotIndex) : exitKeyframeDesktop(slotIndex)}
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, slideStyle]}
        >
          <Animated.View style={[{ width: '100%', height: '100%' }, flipStyle]}>
            {/* Front of the flip = card back */}
            <View style={{ width: '100%', height: '100%', backfaceVisibility: 'hidden' }}>
              <CardBack width={cardWidth} rounded={4} />
            </View>
            {/* Back of the flip = card face */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backfaceVisibility: 'hidden',
                transform: [{ rotateY: '180deg' }],
              }}
            >
              <NativeCard
                width={cardWidth}
                rank={card.rank}
                suit={card.suit}
                bottomEdge
                rounded={4}
                isWinning={isWinning(card)}
                isLosing={winningCards.length > 0 && !isWinning(card)}
              />
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

export const CommunityCards = memo(function CommunityCards({
  cards,
  containerWidth,
  revealedCount = cards.length,
  winningCards = [],
}: CommunityCardsProps) {
  const { cardWidth, gap } = getCommunityCardMetrics(containerWidth);
  const slots = [0, 1, 2, 3, 4];
  const prevRevealedCount = useRef(revealedCount);

  useEffect(() => {
    // Consumed during render (PWA parity — batch delay maths).
    prevRevealedCount.current = revealedCount;
  }, [revealedCount]);

  const renderSlot = (slotIndex: number) => {
    const isDealt = slotIndex < revealedCount && slotIndex < cards.length;
    const card = isDealt ? cards[slotIndex] : null;
    return (
      <Slot
        key={slotIndex}
        slotIndex={slotIndex}
        card={card ?? null}
        isDealt={isDealt}
        revealedCount={revealedCount}
        prevCount={prevRevealedCount.current}
        cardWidth={cardWidth}
        containerWidth={containerWidth}
        winningCards={winningCards}
      />
    );
  };

  if (containerWidth < 365) {
    return (
      <View style={{ alignItems: 'center', gap, width: '100%' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap }}>
          {slots.slice(0, 2).map(renderSlot)}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap }}>
          {slots.slice(2, 4).map(renderSlot)}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap }}>
          {slots.slice(4, 5).map(renderSlot)}
        </View>
      </View>
    );
  }

  if (containerWidth < 768) {
    return (
      <View style={{ alignItems: 'center', gap, width: '100%' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap }}>
          {slots.slice(0, 3).map(renderSlot)}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap }}>
          {slots.slice(3, 5).map(renderSlot)}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap }}>
      {slots.map(renderSlot)}
    </View>
  );
});
