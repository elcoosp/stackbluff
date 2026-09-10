import { motion } from 'framer-motion';
import { Card } from './Card';

interface CommunityCard {
  rank: string;
  suit: string;
}

export const CommunityCards = ({ cards }: { cards: CommunityCard[] }) => (
  <div className="flex gap-4 justify-center">
    {cards.map((card, i) => (
      <motion.div
        key={`${card.rank}-${card.suit}`}
        initial={{ rotateY: 90 }}
        animate={{ rotateY: 0 }}
        transition={{ delay: i * 0.1, type: 'spring' }}
      >
        <Card rank={card.rank} suit={card.suit} className="w-24 h-32" />
      </motion.div>
    ))}
  </div>
);
