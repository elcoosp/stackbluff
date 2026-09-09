import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps {
  rank?: string;
  suit?: string;
  faceDown?: boolean;
  className?: string;
}
export const Card = ({ rank, suit, faceDown, className }: CardProps) => (
  <motion.div
    className={cn(
      'relative w-24 h-32 rounded-lg shadow-2xl',
      faceDown ? 'card-back' : 'bg-white',
      className,
    )}
    whileHover={{ y: -4, transition: { type: 'spring', stiffness: 300 } }}
  >
    {!faceDown && rank && suit && (
      <>
        <span className="absolute top-2 left-2 text-2xl font-bold text-error-container">
          {rank}
        </span>
        <span className="absolute bottom-2 right-2 text-2xl font-bold text-error-container rotate-180">
          {rank}
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center text-6xl"
          style={{ color: suit === '♥' || suit === '♦' ? '#e11d48' : '#1e293b' }}
        >
          {suit === '♥' ? '♥' : suit === '♦' ? '♦' : suit === '♣' ? '♣' : '♠'}
        </span>
      </>
    )}
  </motion.div>
);
export const CardBack = ({ className }: { className?: string }) => (
  <Card
    faceDown
    className={cn('bg-gradient-to-br from-gray-800 to-gray-900 border border-white/20', className)}
  />
);
