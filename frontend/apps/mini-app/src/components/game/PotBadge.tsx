import { motion } from 'framer-motion';
import { Coins } from 'lucide-react';
export const PotBadge = ({ amount }: { amount: number }) => (
  <motion.div className="px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-accent font-mono text-sm flex items-center gap-2" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
    <Coins className="w-4 h-4" /> POT: ${amount.toLocaleString()}
  </motion.div>
);
