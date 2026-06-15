import { motion } from 'framer-motion';
export const ChipStack = ({ amount }: { amount: number }) => (
  <motion.div className="px-2 py-0.5 rounded-full bg-black/60 border border-tertiary/30 text-tertiary font-mono text-xs" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
    ${amount.toLocaleString()}
  </motion.div>
);
