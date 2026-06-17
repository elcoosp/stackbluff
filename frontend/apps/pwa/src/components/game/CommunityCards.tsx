import { motion } from 'framer-motion';
import { Card } from './Card';
import { cn } from '@/lib/utils';

export const CommunityCards = ({
  cards,
  isMobile,
}: {
  cards: any[];
  isMobile?: boolean;
}) => {
  const sizeProp = isMobile ? 'sm' : 'lg';
  const cardClassName = isMobile ? 'w-14 h-20' : 'w-24 h-32';

  return (
    <div className="flex gap-2 md:gap-4 justify-center">
      {cards.map((card, i) => (
        <motion.div
          key={i}
          initial={{ rotateY: 90 }}
          animate={{ rotateY: 0 }}
          transition={{ delay: i * 0.1, type: 'spring' }}
        >
          <Card
            rank={card.rank}
            suit={card.suit}
            className={cardClassName}
            size={sizeProp}
          />
        </motion.div>
      ))}
    </div>
  );
};
