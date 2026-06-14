import { motion } from 'framer-motion';
export const PotBadge = ({ amount }: { amount: number }) => (
  <motion.div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-accent font-mono text-sm" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
    POT: ${amount.toLocaleString()}
  </motion.div>
);
