import { useState, useLayoutEffect, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import { useDealStore } from '@stackbluff/shared/stores/dealStore';
import { useFeedback } from '@stackbluff/shared/hooks/useFeedback';
import {
  desktopPositions,
  getMobilePositions,
  getPositionIndex,
  MAX_SEATS,
  type Position,
} from '@/lib/seatPositions';

const pct = (s: string) => parseFloat(s);

function useViewportWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 500);
  useLayoutEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

interface FlyingCard {
  id: string;
  targetSeatIndex: number;
  seatPosIdx: number;
  round: number;
  delay: number;
  isHero: boolean;
  targetPx: { x: number; y: number };
}

interface DealAnimationLayerProps {
  isDesktop: boolean;
  heroSeat: number;
}

export const DealAnimationLayer = ({ isDesktop, heroSeat }: DealAnimationLayerProps) => {
  const heroHoleCards = useGameStore((s) => s.heroHoleCards);
  const communityCards = useGameStore((s) => s.communityCards);
  const seats = useGameStore((s) => s.seats);
  const { isDealing, startDealing, finishDealing } = useDealStore();
  const { trigger } = useFeedback();
  const vw = useViewportWidth();

  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [deckVisible, setDeckVisible] = useState(false);
  const [dealtCount, setDealtCount] = useState(0);

  const prevHoleCardsKey = useRef('');
  const isFirstRenderRef = useRef(true);
  const currentDealGen = useRef(0);
  const dealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const containerSizeRef = useRef({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (!node) return;
    const updateSize = () => {
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      setContainerSize({ w, h });
      containerSizeRef.current = { w, h };
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);

  useEffect(() => {
    return () => {
      dealTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const isNarrow = !isDesktop && vw < 362;
  const positions = isDesktop ? desktopPositions : getMobilePositions(isNarrow);

  const getTargetPixels = useCallback((posIndex: number, isHero: boolean) => {
    const pos = positions[posIndex];
    if (!pos) return null;

    const { w, h } = containerSizeRef.current;
    if (w === 0 || h === 0) return null;

    const x = (pct(pos.left) / 100) * w;

    // Updated Y calculation to handle bottom property
    let y;
    if (pos.bottom) {
      y = h - parseFloat(pos.bottom);
    } else {
      y = (pct(pos.top) / 100) * h;
    }

    const hubWidth = isHero
      ? (isDesktop ? 160 : 128)
      : (isDesktop ? 120 : 100);

    let centerX = x;
    let centerY = y;

    const transform = pos.transform;
    if (transform.includes('translate(-50%')) {
      centerX = x;
    } else if (transform.includes('translate(0')) {
      centerX = x + (hubWidth / 2);
    } else if (transform.includes('translate(-100%')) {
      centerX = x - (hubWidth / 2);
    }

    // Changed from 52 to 80 to land cards on the hub correctly when anchored from bottom
    centerY -= (isHero ? 80 : 34);

    return { x: centerX, y: centerY };
  }, [positions, isDesktop]);

  const getDeckPixels = useCallback(() => {
    const { w, h } = containerSizeRef.current;
    return {
      x: w * 0.50,
      y: h * (isDesktop ? 0.38 : 0.35),
    };
  }, [isDesktop]);

  useEffect(() => {
    const currentCards = heroHoleCards || [];
    const currentKey = currentCards
      .map((c: any) => `${c.rank}${c.suit}`)
      .join('');

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
  }, [heroHoleCards, communityCards, isDealing]);

  useEffect(() => {
    if (!heroHoleCards || heroHoleCards.length === 0) {
      prevHoleCardsKey.current = '';
    }
  }, [heroHoleCards]);

  const triggerDeal = useCallback(() => {
    dealTimersRef.current.forEach(clearTimeout);
    dealTimersRef.current = [];

    let dealerSeat = 0;
    for (const [idx, seat] of Object.entries(seats)) {
      if ((seat as any).position_badge === 'BTN') {
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

    const cards: FlyingCard[] = [];
    let cardIndex = 0;
    const STAGGER = 0.16;

    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < activeSeats.length; i++) {
        const seatIdx = activeSeats[i];
        const posIdx = getPositionIndex(seatIdx, heroSeat);
        const isHeroCard = seatIdx === heroSeat;
        const targetPx = getTargetPixels(posIdx, isHeroCard);

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

    cards.forEach((card, idx) => {
      const t = setTimeout(() => {
        trigger('cardDeal');
        setDealtCount(idx + 1);
      }, card.delay * 1000);
      dealTimersRef.current.push(t);
    });

    const lastDelay = cards.length > 0 ? cards[cards.length - 1].delay : 0;

    const crossfadeStartMs = (lastDelay + 0.5) * 1000;
    const finishTimer = setTimeout(() => {
      finishDealing();
      setDeckVisible(false);
    }, crossfadeStartMs);

    const cleanupMs = (lastDelay + 1.5) * 1000;
    const cleanupTimer = setTimeout(() => {
      setFlyingCards([]);
      setDealtCount(0);
    }, cleanupMs);

    dealTimersRef.current.push(finishTimer);
    dealTimersRef.current.push(cleanupTimer);
  }, [seats, heroSeat, startDealing, finishDealing, trigger, getTargetPixels]);

  const deckPx = getDeckPixels();

  const cardW = isDesktop ? 30 : 22;
  const cardH = isDesktop ? 42 : 30;

  const totalCards = flyingCards.length || 1;
  const deckLayers = Math.max(1, 5 - Math.floor((dealtCount / totalCards) * 4));

  if (containerSize.w === 0 || containerSize.h === 0) {
    return (
      <div
        ref={setNode}
        className="absolute inset-0 z-[448] pointer-events-none overflow-visible"
      />
    );
  }

  return (
    <div
      ref={setNode}
      className="absolute inset-0 z-[448] pointer-events-none overflow-visible"
    >
      {/* ═══ Deck Stack ═══ */}
      <AnimatePresence>
        {deckVisible && (
          <motion.div
            key="deal-deck"
            initial={{ opacity: 0, scale: 0.65 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.85,
              transition: { duration: 0.4, delay: 0.2 },
            }}
            className="absolute transform-gpu [will-change:transform]"
            style={{
              left: deckPx.x,
              top: deckPx.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="relative"
              style={{ width: cardW + 8, height: cardH + 8 }}
            >
              {Array.from({ length: deckLayers }).map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-sm overflow-hidden"
                  style={{
                    width: cardW + 2,
                    height: cardH + 2,
                    top: -(deckLayers - 1 - i) * 1.8,
                    left: -(deckLayers - 1 - i) * 0.4,
                    background:
                      'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                  }}
                >
                  <div className="absolute inset-[12%] border border-white/8 rounded-sm" />
                  <div
                    className="absolute inset-0 opacity-[0.05]"
                    style={{
                      backgroundImage: `repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 2px,
                        rgba(78,222,163,0.15) 2px,
                        rgba(78,222,163,0.15) 4px
                      )`,
                    }}
                  />
                  <div
                    className="absolute top-0 left-0 right-0 h-[30%] rounded-t-sm"
                    style={{
                      background:
                        'linear-gradient(to bottom, rgba(255,255,255,0.06), transparent)',
                    }}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Flying Cards ═══ */}
      <AnimatePresence>
        {flyingCards.map((card) => {
          const targetPx = card.targetPx;

          const dx = targetPx.x - deckPx.x;
          const dy = targetPx.y - deckPx.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          const arcHeight = Math.min(70, distance * 0.2) + (card.isHero ? 15 : 0);
          const midX = (deckPx.x + targetPx.x) / 2 + (card.round === 0 ? 8 : -8);
          const midY = ((deckPx.y + targetPx.y) / 2) - arcHeight;

          const flightRotation = (card.seatPosIdx % 2 === 0 ? 1 : -1) * (6 + card.round * 4);

          return (
            <motion.div
              key={card.id}
              className="absolute transform-gpu [will-change:transform]"
              style={{
                width: cardW,
                height: cardH,
                perspective: '800px',
              }}
              initial={{
                x: deckPx.x - cardW / 2,
                y: deckPx.y - cardH / 2,
                scale: 0.4,
                opacity: 0,
                rotate: 0,
              }}
              animate={{
                x: [
                  deckPx.x - cardW / 2,
                  midX - cardW / 2,
                  targetPx.x - cardW / 2,
                  targetPx.x - cardW / 2,
                ],
                y: [
                  deckPx.y - cardH / 2,
                  midY - cardH / 2,
                  targetPx.y - cardH / 2,
                  targetPx.y - cardH / 2,
                ],
                scale: [0.4, 1.05, 1.0, 1.0],
                opacity: [0, 1, 1, 0],
                rotate: [0, flightRotation, 0, 0],
              }}
              transition={{
                delay: card.delay,
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
                times: [0, 0.3, 0.55, 1.0],
              }}
            >
              {/* Card back body */}
              <div
                className="w-full h-full rounded-sm overflow-hidden relative"
                style={{
                  background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
                  border: '1px solid rgba(255,255,255,0.28)',
                  boxShadow: `0 8px 24px rgba(0,0,0,0.8),
                              0 3px 8px rgba(0,0,0,0.4)${card.isHero
                      ? ', 0 0 20px rgba(78,222,163,0.15)'
                      : ''
                    }`,
                }}
              >
                <div className="absolute inset-[12%] border border-white/10 rounded-sm" />
                <div
                  className="absolute inset-0 opacity-[0.06]"
                  style={{
                    backgroundImage: `repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 2px,
                      rgba(78,222,163,0.15) 2px,
                      rgba(78,222,163,0.15) 4px
                    )`,
                  }}
                />
                <div className="absolute top-[10%] left-[10%] w-[10%] h-[10%] border-t border-l border-white/12 rounded-tl-sm" />
                <div className="absolute bottom-[10%] right-[10%] w-[10%] h-[10%] border-b border-r border-white/12 rounded-br-sm" />
                <div
                  className="absolute top-0 left-0 right-0 h-[35%] rounded-t-sm"
                  style={{
                    background:
                      'linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)',
                  }}
                />
              </div>

              {/* Hero arrival glow (Animated opacity instead of boxShadow) */}
              {card.isHero && card.round === 1 && (
                <motion.div
                  className="absolute -inset-3 rounded-sm pointer-events-none"
                  style={{
                    boxShadow: '0 0 40px rgba(78,222,163,0.4), 0 0 80px rgba(78,222,163,0.15)',
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{
                    delay: card.delay + 0.45,
                    duration: 0.8,
                  }}
                />
              )}

              {/* Dynamic motion shadow (Animating y/scale instead of top) */}
              <motion.div
                className="absolute pointer-events-none rounded-full transform-gpu"
                style={{
                  width: cardW * 0.8,
                  height: 4,
                  left: '10%',
                  top: cardH + 5,
                  background: 'rgba(0,0,0,0.5)',
                  filter: 'blur(4px)',
                }}
                animate={{
                  y: [5, -1, 0, 0],
                  opacity: [0, 0.4, 0.6, 0],
                  scale: [1.5, 1.1, 0.9, 0.9],
                }}
                transition={{
                  delay: card.delay,
                  duration: 0.8,
                  times: [0, 0.3, 0.55, 1.0],
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
