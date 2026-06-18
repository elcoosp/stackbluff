import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardBack } from './Card';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface CommunityCardsProps {
  cards: any[];
  isMobile?: boolean;
  revealedCount?: number;
}

// ── Hook to get window width ──
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
}

export const CommunityCards = ({
  cards,
  isMobile = false,
  revealedCount = cards.length,
}: CommunityCardsProps) => {
  const totalSlots = 5;
  const slots = Array.from({ length: totalSlots }, (_, i) => i);

  const windowWidth = useWindowWidth();

  // Determine card size based on window width
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

  const realCardClass = `${cardWidth} ${cardHeight} ${roundedClass} border-b-4 border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-all duration-300`;

  const getBackCardClass = (index: number) => {
    // Highlight all 3 flop cards if pre-flop
    const isFlopPhase = revealedCount === 0;
    const isTurnPhase = revealedCount === 3;
    const isRiverPhase = revealedCount === 4;

    const isNextStreet = (isFlopPhase && index < 3) ||
      (isTurnPhase && index === 3) ||
      (isRiverPhase && index === 4);

    const opacity = isNextStreet ? 'opacity-100' : 'opacity-50';
    const border = isNextStreet ? 'border-2 border-tertiary/40' : 'border-0';
    const shadow = isNextStreet ? 'shadow-[0_0_20px_rgba(78,222,163,0.15)]' : 'shadow-none';
    return `${cardWidth} ${cardHeight} ${roundedClass} ${opacity} ${border} ${shadow} transition-all duration-300`;
  };

  const flopSlots = slots.slice(0, 3);
  const turnRiverSlots = slots.slice(3, 5);

  const cardVariants = {
    hidden: { rotateY: 90, opacity: 0 },
    visible: {
      rotateY: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
        delay: 0.05,
      },
    },
  };

  const renderSlot = (slotIndex: number) => {
    const isFaceUp = slotIndex < revealedCount && slotIndex < cards.length;
    const card = isFaceUp ? cards[slotIndex] : null;

    return (
      <motion.div
        key={slotIndex}
        className="flex justify-center perspective-500"
        style={{ perspective: '500px' }}
      >
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <AnimatePresence mode="wait">
            {isFaceUp ? (
              <motion.div
                key="front"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit={{ rotateY: -90, opacity: 0, transition: { duration: 0.15 } }}
                className="relative"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <Card
                  rank={card.rank}
                  suit={card.suit}
                  className={realCardClass}
                  size={sizeProp}
                  hoverable={false}
                />
              </motion.div>
            ) : (
              <motion.div
                key="back"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit={{ rotateY: -90, opacity: 0, transition: { duration: 0.15 } }}
                className="relative"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <CardBack
                  className={getBackCardClass(slotIndex)}
                  size={sizeProp}
                  rounded={roundedClass}
                  hoverable={false}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    );
  };

  // ── Layout ──
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
