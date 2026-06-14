import { motion } from 'framer-motion';
export const PotBadge = ({ amount }: { amount: number }) => (
  <motion.div className="px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-accent font-mono text-sm" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
    POT: ${amount.toLocaleString()}
  </motion.div>
);
