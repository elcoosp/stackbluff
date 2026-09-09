import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const ChipStack = ({ amount, size = 'text-xs' }: { amount: number; size?: string }) => (
  <motion.div
    className={cn(
      'px-2 py-0.5 rounded-full bg-black/60 border border-tertiary/30 text-tertiary font-mono',
      size,
    )}
    initial={{ scale: 0.8 }}
    animate={{ scale: 1 }}
    transition={{ type: 'spring' }}
  >
    ${amount.toLocaleString()}
  </motion.div>
);
