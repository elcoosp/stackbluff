/**
 * DealAnimationLayer — Reanimated port of PWA
 * `components/game/DealAnimationLayer.tsx` (deck → seat stagger).
 *
 * When the hero's hole-card key changes (new hand, no community cards yet),
 * a card-back deck pops in at the felt center (y 35% mobile / 38% desktop)
 * and one back per active seat flies out, two rounds, 0.16s stagger, along
 * an arc (mid point ±8px by round, arc height min(70, distance×0.2) + 15
 * hero bonus) with the exact Framer keyframes:
 *   duration 0.8s, ease cubic-bezier(0.22,1,0.36,1), times [0, .3, .55, 1]
 *   x/y deck→mid→target→target, scale [.4, 1.05, 1, 1], opacity [0,1,1,0],
 *   rotate [0, ±(6 + round·4), 0, 0] (± by seat position parity)
 * plus the hero round-1 arrival glow (opacity [0,1,0], delay +0.45s, 0.8s),
 * the flying ground shadow (y [5,-1,0,0], opacity [0,.4,.6,0], scale
 * [1.5,1.1,.9,.9]) and the deck thinning 5→1 as cards are dealt. All
 * timing runs on the UI thread; only the deal scheduling is JS.
 */

import { useFeedback } from '@stackbluff/shared/src/hooks/useFeedback';
import { useDealStore } from '@stackbluff/shared/src/stores/dealStore';
import type { Seat } from '@stackbluff/shared/src/stores/gameStore';
import {
  getPositionIndex,
  getTablePositions,
  MAX_SEATS,
  type Position,
} from '@stackbluff/ui-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const pct = (s: string) => Number.parseFloat(s);

const STAGGER = 0.16; // s between cards (PWA STAGGER)
const FLIGHT_MS = 800; // total flight duration
const SEG_1 = 0.3; // times[1]
const SEG_2 = 0.55; // times[2]
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

interface FlyingCard {
  id: string;
  targetSeatIndex: number;
  seatPosIdx: number;
  round: number;
  delay: number; // seconds
  isHero: boolean;
  targetPx: { x: number; y: number };
}

export interface DealAnimationLayerProps {
  isDesktop: boolean;
  heroSeat: number;
  heroHoleCards: { rank: string; suit: string }[];
  communityCards: { rank: string; suit: string }[];
  seats: Record<number, Seat>;
}

/** Seat/pot anchor → container px (ports getTargetPixels + toPixels). */
function toPixels(
  pos: Position,
  w: number,
  h: number,
  isHero: boolean,
  isDesktop: boolean,
): { x: number; y: number } | null {
  const x = (pct(pos.left) / 100) * w;

  let y: number;
  if (pos.bottom) {
    y = h - Number.parseFloat(pos.bottom);
  } else {
    y = (pct(pos.top) / 100) * h;
  }

  const hubWidth = isHero ? (isDesktop ? 160 : 128) : isDesktop ? 120 : 100;

  let centerX = x;
  const transform = pos.transform;
  if (transform.includes('translate(0')) {
    centerX = x + hubWidth / 2;
  } else if (transform.includes('translate(-100%')) {
    centerX = x - hubWidth / 2;
  } // translate(-50% → center is x itself

  // Land cards on the hub (anchored-from-bottom hero needs the bigger lift).
  const centerY = y - (isHero ? 80 : 34);
  return { x: centerX, y: centerY };
}

export function DealAnimationLayer({
  isDesktop,
  heroSeat,
  heroHoleCards,
  communityCards,
  seats,
}: DealAnimationLayerProps) {
  const { isDealing, startDealing, finishDealing } = useDealStore();
  const { trigger } = useFeedback();

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [deckVisible, setDeckVisible] = useState(false);
  const [dealtCount, setDealtCount] = useState(0);

  const prevHoleCardsKey = useRef('');
  const isFirstRenderRef = useRef(true);
  const currentDealGen = useRef(0);
  const dealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height },
    );
  }, []);

  useEffect(() => {
    return () => {
      dealTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const isNarrow = !isDesktop && size.w > 0 && size.w < 362;
  void isNarrow;
  const positions = useMemo(() => getTablePositions(!isDesktop), [isDesktop]);

  const deckPx = useMemo(
    () => ({ x: size.w * 0.5, y: size.h * (isDesktop ? 0.38 : 0.35) }),
    [size, isDesktop],
  );

  const triggerDeal = useCallback(() => {
    dealTimersRef.current.forEach(clearTimeout);
    dealTimersRef.current = [];

    let dealerSeat = 0;
    for (const [idx, seat] of Object.entries(seats)) {
      if (seat.position_badge === 'BTN') {
        dealerSeat = Number(idx);
        break;
      }
    }

    const activeSeats: number[] = [];
    for (let i = 0; i < MAX_SEATS; i++) {
      const seatIdx = (dealerSeat + 1 + i) % MAX_SEATS;
      const seat = seats[seatIdx];
      if (seat && !seat.is_folded) {
        activeSeats.push(seatIdx);
      }
    }
    if (activeSeats.length === 0) return;
    if (size.w === 0 || size.h === 0) return;

    const cards: FlyingCard[] = [];
    let cardIndex = 0;

    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < activeSeats.length; i++) {
        const seatIdx = activeSeats[i];
        const posIdx = getPositionIndex(seatIdx, heroSeat);
        const isHeroCard = seatIdx === heroSeat;
        const pos = positions[posIdx];
        if (!pos) continue;
        const targetPx = toPixels(pos, size.w, size.h, isHeroCard, isDesktop);
        if (!targetPx) continue;

        cards.push({
          id: `deal-${currentDealGen.current}-${round}-${seatIdx}`,
          targetSeatIndex: seatIdx,
          seatPosIdx: posIdx,
          round,
          delay: cardIndex * STAGGER,
          isHero: isHeroCard,
          targetPx,
        });
        cardIndex++;
      }
    }
    if (cards.length === 0) return;

    currentDealGen.current += 1;
    startDealing();
    setFlyingCards(cards);
    setDeckVisible(true);
    setDealtCount(0);

    for (const [idx, card] of cards.entries()) {
      const t = setTimeout(() => {
        trigger('cardDeal');
        setDealtCount(idx + 1);
      }, card.delay * 1000);
      dealTimersRef.current.push(t);
    }

    const lastDelay = cards.length > 0 ? cards[cards.length - 1].delay : 0;

    const finishTimer = setTimeout(
      () => {
        finishDealing();
        setDeckVisible(false);
      },
      (lastDelay + 0.5) * 1000,
    );
    const cleanupTimer = setTimeout(
      () => {
        setFlyingCards([]);
        setDealtCount(0);
      },
      (lastDelay + 1.5) * 1000,
    );
    dealTimersRef.current.push(finishTimer);
    dealTimersRef.current.push(cleanupTimer);
  }, [seats, heroSeat, positions, size, isDesktop, startDealing, finishDealing, trigger]);

  useEffect(() => {
    const currentCards = heroHoleCards || [];
    const currentKey = currentCards.map((c) => `${c.rank}${c.suit}`).join('');

    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevHoleCardsKey.current = currentKey;
      return;
    }

    const cardsChanged = currentKey !== prevHoleCardsKey.current;
    const noCommunity = (communityCards || []).length === 0;
    const hasCards = currentCards.length > 0;

    if (cardsChanged && hasCards && noCommunity && !isDealing) {
      triggerDeal();
    }

    prevHoleCardsKey.current = currentKey;
  }, [heroHoleCards, communityCards, isDealing, triggerDeal]);

  const cardW = isDesktop ? 30 : 22;
  const cardH = isDesktop ? 42 : 30;

  const totalCards = flyingCards.length || 1;
  const deckLayers = Math.max(1, 5 - Math.floor((dealtCount / totalCards) * 4));

  return (
    <View
      onLayout={onLayout}
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 448 }}
    >
      {/* ═══ Deck stack (mounted; opacity/scale driven by `visible`) ═══ */}
      {size.w > 0 && (
        <DeckStack
          visible={deckVisible}
          deckPx={deckPx}
          cardW={cardW}
          cardH={cardH}
          layers={deckLayers}
        />
      )}

      {/* ═══ Flying cards ═══ */}
      {flyingCards.map((card) => (
        <FlyingDealCard key={card.id} card={card} deckPx={deckPx} cardW={cardW} cardH={cardH} />
      ))}
    </View>
  );
}

/* ── Deck stack (enter pop 0.65→1, exit fade 0.4s + 0.2s delay) ─────────── */
function DeckStack({
  visible,
  deckPx,
  cardW,
  cardH,
  layers,
}: {
  visible: boolean;
  deckPx: { x: number; y: number };
  cardW: number;
  cardH: number;
  layers: number;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.65);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withTiming(1, { duration: 200, easing: EASE });
    } else {
      // exit: opacity 0, scale 0.85 (0.4s, +0.2s delay) — AnimatePresence port.
      opacity.value = withDelay(200, withTiming(0, { duration: 400 }));
      scale.value = withDelay(200, withTiming(0.85, { duration: 400 }));
    }
  }, [visible, opacity, scale]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: deckPx.x,
          top: deckPx.y,
          width: cardW + 8,
          height: cardH + 8,
          marginLeft: -(cardW + 8) / 2,
          marginTop: -(cardH + 8) / 2,
        },
        anim,
      ]}
    >
      {Array.from({ length: layers }).map((_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: deck layers are positional
          key={`deck-layer-${i}`}
          style={{
            position: 'absolute',
            width: cardW + 2,
            height: cardH + 2,
            borderRadius: 4,
            top: -(layers - 1 - i) * 1.8,
            left: -(layers - 1 - i) * 0.4,
            backgroundColor: '#141414',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.6,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {/* inset-[12%] inner border */}
          <View
            style={{
              position: 'absolute',
              top: '12%',
              left: '12%',
              right: '12%',
              bottom: '12%',
              borderRadius: 4,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          />
          {/* 45° emerald pinstripe (repeating-linear-gradient stand-in) */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.05,
              backgroundColor: 'rgba(78,222,163,0.15)',
            }}
          />
          {/* top sheen h-30% */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '30%',
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
          />
        </View>
      ))}
    </Animated.View>
  );
}

/* ── One flying card (Framer keyframes → withSequence segments) ─────────── */
function FlyingDealCard({
  card,
  deckPx,
  cardW,
  cardH,
}: {
  card: FlyingCard;
  deckPx: { x: number; y: number };
  cardW: number;
  cardH: number;
}) {
  const targetPx = card.targetPx;

  const dx = targetPx.x - deckPx.x;
  const dy = targetPx.y - deckPx.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const arcHeight = Math.min(70, distance * 0.2) + (card.isHero ? 15 : 0);
  const midX = (deckPx.x + targetPx.x) / 2 + (card.round === 0 ? 8 : -8);
  const midY = (deckPx.y + targetPx.y) / 2 - arcHeight;

  const flightRotation = (card.seatPosIdx % 2 === 0 ? 1 : -1) * (6 + card.round * 4);

  // Framer times [0, 0.3, 0.55, 1.0] × 800ms → segments 240 / 200 / 360 ms.
  const d1 = FLIGHT_MS * SEG_1;
  const d2 = FLIGHT_MS * (SEG_2 - SEG_1);
  const d3 = FLIGHT_MS * (1 - SEG_2);
  const delayMs = card.delay * 1000;

  const x = useSharedValue(deckPx.x - cardW / 2);
  const y = useSharedValue(deckPx.y - cardH / 2);
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    x.value = withDelay(
      delayMs,
      withSequence(
        withTiming(midX - cardW / 2, { duration: d1, easing: EASE }),
        withTiming(targetPx.x - cardW / 2, { duration: d2, easing: EASE }),
        withTiming(targetPx.x - cardW / 2, { duration: d3, easing: EASE }),
      ),
    );
    y.value = withDelay(
      delayMs,
      withSequence(
        withTiming(midY - cardH / 2, { duration: d1, easing: EASE }),
        withTiming(targetPx.y - cardH / 2, { duration: d2, easing: EASE }),
        withTiming(targetPx.y - cardH / 2, { duration: d3, easing: EASE }),
      ),
    );
    scale.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1.05, { duration: d1, easing: EASE }),
        withTiming(1.0, { duration: d2, easing: EASE }),
        withTiming(1.0, { duration: d3, easing: EASE }),
      ),
    );
    opacity.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1, { duration: d1, easing: EASE }),
        withTiming(1, { duration: d2, easing: EASE }),
        withTiming(0, { duration: d3, easing: EASE }),
      ),
    );
    rotate.value = withDelay(
      delayMs,
      withSequence(
        withTiming(flightRotation, { duration: d1, easing: EASE }),
        withTiming(0, { duration: d2, easing: EASE }),
        withTiming(0, { duration: d3, easing: EASE }),
      ),
    );
  }, [
    delayMs,
    d1,
    d2,
    d3,
    midX,
    midY,
    targetPx.x,
    targetPx.y,
    cardW,
    cardH,
    flightRotation,
    x,
    y,
    scale,
    opacity,
    rotate,
  ]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, width: cardW, height: cardH, zIndex: 448 }}
    >
      <Animated.View style={[{ width: '100%', height: '100%' }, anim]}>
        {/* Card back body */}
        <View
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 4,
            backgroundColor: '#141414',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.28)',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.8,
            shadowRadius: 24,
            elevation: 10,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: '12%',
              left: '12%',
              right: '12%',
              bottom: '12%',
              borderRadius: 4,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.06,
              backgroundColor: 'rgba(78,222,163,0.15)',
            }}
          />
          {/* corner brackets */}
          <View
            style={{
              position: 'absolute',
              top: '10%',
              left: '10%',
              width: '10%',
              height: '10%',
              borderTopWidth: 1,
              borderLeftWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              borderTopLeftRadius: 4,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: '10%',
              right: '10%',
              width: '10%',
              height: '10%',
              borderBottomWidth: 1,
              borderRightWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              borderBottomRightRadius: 4,
            }}
          />
          {/* top sheen h-35% */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '35%',
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          />
        </View>

        {/* Hero round-1 arrival glow (opacity [0,1,0], delay +0.45s, 0.8s) */}
        {card.isHero && card.round === 1 && <HeroGlow delayMs={delayMs} />}

        {/* Dynamic motion shadow */}
        <MotionShadow delayMs={delayMs} cardW={cardW} cardH={cardH} />
      </Animated.View>
    </Animated.View>
  );
}

function HeroGlow({ delayMs }: { delayMs: number }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(
      delayMs + 450,
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      ),
    );
  }, [delayMs, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: -12,
          left: -12,
          right: -12,
          bottom: -12,
          borderRadius: 8,
          borderWidth: 6,
          borderColor: 'rgba(78,222,163,0.35)',
        },
        style,
      ]}
    />
  );
}

function MotionShadow({
  delayMs,
  cardW,
  cardH,
}: {
  delayMs: number;
  cardW: number;
  cardH: number;
}) {
  const y = useSharedValue(5);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1.5);

  useEffect(() => {
    const d1 = FLIGHT_MS * SEG_1;
    const d2 = FLIGHT_MS * (SEG_2 - SEG_1);
    const d3 = FLIGHT_MS * (1 - SEG_2);
    y.value = withDelay(
      delayMs,
      withSequence(
        withTiming(-1, { duration: d1, easing: EASE }),
        withTiming(0, { duration: d2, easing: EASE }),
        withTiming(0, { duration: d3, easing: EASE }),
      ),
    );
    opacity.value = withDelay(
      delayMs,
      withSequence(
        withTiming(0.4, { duration: d1, easing: EASE }),
        withTiming(0.6, { duration: d2, easing: EASE }),
        withTiming(0, { duration: d3, easing: EASE }),
      ),
    );
    scale.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1.1, { duration: d1, easing: EASE }),
        withTiming(0.9, { duration: d2, easing: EASE }),
        withTiming(0.9, { duration: d3, easing: EASE }),
      ),
    );
  }, [delayMs, y, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: cardW * 0.8,
          height: 4,
          left: '10%',
          top: cardH + 5,
          borderRadius: 2,
          backgroundColor: 'rgba(0,0,0,0.5)',
        },
        style,
      ]}
    />
  );
}
