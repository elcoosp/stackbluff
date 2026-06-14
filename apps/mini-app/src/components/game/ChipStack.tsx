import { motion } from 'framer-motion';
export const ChipStack = ({ amount }: { amount: number }) => (
  <motion.div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 border border-accent/30 text-accent font-mono text-xs" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
    <span className="material-symbols-outlined text-[14px]">paid</span> {amount.toLocaleString()}
  </motion.div>
);
