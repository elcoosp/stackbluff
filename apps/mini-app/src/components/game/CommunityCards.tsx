import { motion } from 'framer-motion';
import { Card } from './Card';
export const CommunityCards = ({ cards }: { cards: any[] }) => (
  <div className="flex gap-2">
    {cards.map((card, i) => (
      <motion.div key={i} initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ delay: i * 0.1, type: "spring" }}>
        <Card rank={card.rank} suit={card.suit} />
      </motion.div>
    ))}
  </div>
);
