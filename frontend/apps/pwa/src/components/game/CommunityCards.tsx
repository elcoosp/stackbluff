import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardBack } from './Card';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

interface CommunityCardsProps {
  cards: any[];
  isMobile?: boolean;
  revealedCount?: number;
  winningCards?: Array<{ rank: string; suit: string }>;
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

/* ── EmptySlot ── */
function EmptySlot({ isNextStreet }: { isNextStreet: boolean }) {
  return (
    <motion.div
      className={cn(
        'w-full h-full rounded-sm relative overflow-hidden transition-[width,height] duration-300 ease-in-out',
        isNextStreet
          ? 'border border-dashed border-tertiary/25 bg-tertiary/[0.02]'
          : 'border border-dashed border-white/[0.05] bg-white/[0.008]'
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

/* ── CommunityCards ── */
export const CommunityCards = ({
  cards,
  isMobile = false,
  revealedCount = cards.length,
  winningCards = [],
}: CommunityCardsProps) => {
  const totalSlots = 5;
  const slots = Array.from({ length: totalSlots }, (_, i) => i);
  const windowWidth = useWindowWidth();

  let cardWidth = 'w-28';
  let cardHeight = 'h-40';
  let gap = 'gap-5';
  let containerMaxWidth = 'max-w-none';

  if (windowWidth < 365) {
    cardWidth = 'w-14';
    cardHeight = 'h-20';
    gap = 'gap-2';
    containerMaxWidth = 'max-w-[150px]';
  } else if (windowWidth < 400) {
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
    cardWidth = 'w-16';
    cardHeight = 'h-24';
    gap = 'gap-3';
    containerMaxWidth = 'max-w-sm';
  } else if (windowWidth < 846) {
    cardWidth = 'w-20';
    cardHeight = 'h-28';
    gap = 'gap-3';
    containerMaxWidth = 'max-w-md';
  } else if (windowWidth < 980) {
    cardWidth = 'w-24';
    cardHeight = 'h-32';
    gap = 'gap-4';
    containerMaxWidth = 'max-w-lg';
  } else {
    cardWidth = 'w-28';
    cardHeight = 'h-40';
    gap = 'gap-5';
    containerMaxWidth = 'max-w-none';
  }

  const sizeProp = windowWidth < 980 ? 'lg' : 'xl';
  const roundedClass = 'rounded-sm';

  const hasShowdownWinner = winningCards.length > 0;

  const isWinningCard = (card: any) => {
    return winningCards.some((wc) => wc.rank === card.rank && wc.suit === card.suit);
  };

  const realCardClass = cn(`${cardWidth} ${cardHeight} ${roundedClass} border-b-4 border-gray-200 transition-[width,height] duration-300 ease-in-out`);

  const prevRevealedCount = useRef(revealedCount);
  useEffect(() => {
    prevRevealedCount.current = revealedCount;
  }, [revealedCount]);

  const isNextStreet = (idx: number): boolean => {
    if (revealedCount === 0 && idx < 3) return true;
    if (revealedCount === 3 && idx === 3) return true;
    if (revealedCount === 4 && idx === 4) return true;
    return false;
  };

  // Splitting slots for different layouts
  const row1Slots = slots.slice(0, 2); // 2 cards
  const row2Slots = slots.slice(2, 4); // 2 cards
  const row3Slots = slots.slice(4, 5); // 1 card

  const flopSlots = slots.slice(0, 3); // 3 cards
  const turnRiverSlots = slots.slice(3, 5); // 2 cards

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
      <div
        key={slotIndex}
        className={cn('relative transition-[width,height] duration-300 ease-in-out', cardWidth, cardHeight)}
        style={{ perspective: '700px' }}
      >
        <AnimatePresence>
          {!isDealt && <EmptySlot isNextStreet={isNextStreet(slotIndex)} />}
        </AnimatePresence>

        {isDealt && (
          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: 'preserve-3d' }}
            initial={{
              y: windowWidth < 768 ? -80 : -120,
              scale: 0.88,
              opacity: 0,
              boxShadow: '0 30px 60px rgba(0,0,0,0.9)',
            }}
            animate={{
              y: 0,
              scale: 1,
              opacity: 1,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
            transition={{
              delay: dealDelay,
              type: 'spring',
              damping: 18,
              stiffness: 380,
              mass: 0.8,
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
              <div style={{ backfaceVisibility: 'hidden' }} className="transition-[width,height] duration-300 ease-in-out">
                <CardBack
                  className={`${cardWidth} ${cardHeight} ${roundedClass} transition-[width,height] duration-300 ease-in-out`}
                  size={sizeProp}
                  rounded={roundedClass}
                  hoverable={false}
                />
              </div>

              {/* Back: Card Front */}
              <div
                className="absolute inset-0 transition-[width,height] duration-300 ease-in-out"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <Card
                  rank={card.rank}
                  suit={card.suit}
                  className={realCardClass}
                  size={sizeProp}
                  hoverable={false}
                  isWinning={isWinningCard(card)}
                  isLosing={hasShowdownWinner && !isWinningCard(card)}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    );
  };

  const containerClasses = `flex flex-col items-center ${gap} w-full ${containerMaxWidth} mx-auto transition-all duration-300`;

  // 3-row layout for extremely narrow screens (< 365px)
  if (windowWidth < 365) {
    return (
      <div className={containerClasses}>
        <div className={`flex justify-center ${gap} w-full transition-all duration-300`}>
          {row1Slots.map((idx) => renderSlot(idx))}
        </div>
        <div className={`flex justify-center ${gap} w-full transition-all duration-300`}>
          {row2Slots.map((idx) => renderSlot(idx))}
        </div>
        <div className={`flex justify-center ${gap} w-full transition-all duration-300`}>
          {row3Slots.map((idx) => renderSlot(idx))}
        </div>
      </div>
    );
  }

  // 2-row layout for mobile/tablets (< 768px)
  if (windowWidth < 768) {
    return (
      <div className={containerClasses}>
        <div className={`flex justify-center ${gap} w-full transition-all duration-300`}>
          {flopSlots.map((idx) => renderSlot(idx))}
        </div>
        <div className={`flex justify-center ${gap} w-full transition-all duration-300`}>
          {turnRiverSlots.map((idx) => renderSlot(idx))}
        </div>
      </div>
    );
  }

  // 1-row layout for desktops
  return (
    <div className={`flex justify-center ${gap} transition-all duration-300`}>
      {slots.map((idx) => renderSlot(idx))}
    </div>
  );
};
