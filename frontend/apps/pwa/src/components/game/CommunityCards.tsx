import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardBack } from './Card';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

interface CommunityCardsProps {
  cards: any[];
  isMobile?: boolean;
  revealedCount?: number;
}

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
}

/* ═══════════════════════════════════════════════════════════════════
   EmptySlot — dashed placeholder with optional "next street" pulse
   ═══════════════════════════════════════════════════════════════════ */
function EmptySlot({
  isNextStreet,
}: {
  isNextStreet: boolean;
}) {
  return (
    <motion.div
      className={cn(
        'w-full h-full rounded-sm relative overflow-hidden',
        isNextStreet
          ? 'border border-dashed border-tertiary/25 bg-tertiary/[0.02]'
          : 'border border-dashed border-white/[0.05] bg-white/[0.008]',
      )}
      exit={{ scale: 0.85, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
    >
      {isNextStreet && (
        <motion.div
          className="absolute inset-0 rounded-sm bg-tertiary/[0.04]"
          animate={{ opacity: [0.15, 0.45, 0.15] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CommunityCards
   ═══════════════════════════════════════════════════════════════════ */
export const CommunityCards = ({
  cards,
  isMobile = false,
  revealedCount = cards.length,
}: CommunityCardsProps) => {
  const totalSlots = 5;
  const slots = Array.from({ length: totalSlots }, (_, i) => i);
  const windowWidth = useWindowWidth();

  let cardWidth = 'w-28';
  let cardHeight = 'h-40';
  let gap = 'gap-5';
  let containerMaxWidth = 'max-w-none';

  if (windowWidth < 400) {
    cardWidth = 'w-14';
    cardHeight = 'h-20';
    gap = 'gap-2';
    containerMaxWidth = 'max-w-xs';
  } else if (windowWidth < 480) {
    cardWidth = 'w-16';
    cardHeight = 'h-24';
    gap = 'gap-2.5';
    containerMaxWidth = 'max-w-sm';
  } else if (windowWidth < 640) {
    cardWidth = 'w-20';
    cardHeight = 'h-28';
    gap = 'gap-3';
    containerMaxWidth = 'max-w-md';
  } else if (windowWidth < 768) {
    cardWidth = 'w-24';
    cardHeight = 'h-34';
    gap = 'gap-4';
    containerMaxWidth = 'max-w-lg';
  } else {
    cardWidth = 'w-28';
    cardHeight = 'h-40';
    gap = 'gap-5';
    containerMaxWidth = 'max-w-none';
  }

  const sizeProp = windowWidth < 768 ? 'lg' : 'xl';
  const roundedClass = 'rounded-sm';
  const realCardClass = `${cardWidth} ${cardHeight} ${roundedClass} border-b-4 border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.3)]`;

  const prevRevealedCount = useRef(revealedCount);
  useEffect(() => {
    prevRevealedCount.current = revealedCount;
  }, [revealedCount]);

  // ── Which placeholders are "next street" ──
  // Pre-flop: all 3 flop slots glow
  // Post-flop: turn slot glows
  // Post-turn: river slot glows
  const isNextStreet = (idx: number): boolean => {
    if (revealedCount === 0 && idx < 3) return true;
    if (revealedCount === 3 && idx === 3) return true;
    if (revealedCount === 4 && idx === 4) return true;
    return false;
  };

  const flopSlots = slots.slice(0, 3);
  const turnRiverSlots = slots.slice(3, 5);

  const SLIDE_DURATION = 0.28;
  const PAUSE = 0.12;
  const FLIP_DURATION = 0.32;
  const FLOP_STAGGER = 0.1;

  const renderSlot = (slotIndex: number) => {
    const isDealt = slotIndex < revealedCount && slotIndex < cards.length;
    const card = isDealt ? cards[slotIndex] : null;

    const prevCount = prevRevealedCount.current;
    const numNewCards = Math.max(0, revealedCount - prevCount);
    const batchStart = Math.min(prevCount, revealedCount);
    const isInCurrentBatch = slotIndex >= batchStart && slotIndex < revealedCount;
    const dealDelay = isInCurrentBatch && numNewCards > 1
      ? (slotIndex - batchStart) * FLOP_STAGGER
      : 0;

    const flipDelay = dealDelay + SLIDE_DURATION + PAUSE;

    return (
      // ── Wrapper: explicit dimensions so children can use absolute ──
      <div
        key={slotIndex}
        className={cn('relative', cardWidth, cardHeight)}
        style={{ perspective: '700px' }}
      >
        {/* ── Placeholder (exits when card arrives) ── */}
        <AnimatePresence>
          {!isDealt && (
            <EmptySlot isNextStreet={isNextStreet(slotIndex)} />
          )}
        </AnimatePresence>

        {/* ── Dealt card (slides in + flips) ── */}
        {isDealt && (
          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: 'preserve-3d' }}
            initial={{
              y: windowWidth < 768 ? -80 : -120,
              scale: 0.92,
              opacity: 0,
            }}
            animate={{
              y: 0,
              scale: 1,
              opacity: 1,
            }}
            transition={{
              delay: dealDelay,
              duration: SLIDE_DURATION,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            <motion.div
              style={{ transformStyle: 'preserve-3d' }}
              animate={{ rotateY: -180 }}
              transition={{
                rotateY: {
                  delay: flipDelay,
                  duration: FLIP_DURATION,
                  ease: [0.4, 0, 0.2, 1],
                },
              }}
            >
              {/* Front: Card Back */}
              <div style={{ backfaceVisibility: 'hidden' }}>
                <CardBack
                  className={`${cardWidth} ${cardHeight} ${roundedClass}`}
                  size={sizeProp}
                  rounded={roundedClass}
                  hoverable={false}
                />
              </div>

              {/* Back: Card Front */}
              <div
                className="absolute inset-0"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <Card
                  rank={card.rank}
                  suit={card.suit}
                  className={realCardClass}
                  size={sizeProp}
                  hoverable={false}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    );
  };

  const containerClasses = `flex flex-col items-center ${gap} w-full ${containerMaxWidth} mx-auto transition-all duration-300`;

  if (windowWidth < 768) {
    return (
      <div className={containerClasses}>
        <div className={`flex justify-center ${gap} w-full`}>
          {flopSlots.map((idx) => renderSlot(idx))}
        </div>
        <div className={`flex justify-center ${gap} w-full`}>
          {turnRiverSlots.map((idx) => renderSlot(idx))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex justify-center ${gap}`}>
      {slots.map((idx) => renderSlot(idx))}
    </div>
  );
};
