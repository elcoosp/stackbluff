import { motion } from 'framer-motion';
import { Card } from './Card';
export const CommunityCards = ({ cards }: { cards: any[] }) => (
  <div className="flex gap-4 justify-center">
    {cards.map((card, i) => (
      <motion.div key={i} initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ delay: i * 0.1, type: "spring" }}>
        <Card rank={card.rank} suit={card.suit} className="w-24 h-32" />
      </motion.div>
    ))}
  </div>
);
