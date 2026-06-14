import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
interface CardProps { rank?: string; suit?: string; faceDown?: boolean; className?: string; }
export const Card = ({ rank, suit, faceDown, className }: CardProps) => (
  <motion.div className={cn("relative w-14 h-20 rounded-md shadow-lg", faceDown ? "card-back" : "bg-white", className)} whileHover={{ y: -4, transition: { type: "spring", stiffness: 300 } }}>
    {!faceDown && rank && suit && (
      <>
        <span className="absolute top-1 left-1 text-sm font-bold text-red-600">{rank}</span>
        <span className="absolute bottom-1 right-1 text-sm font-bold text-red-600 rotate-180">{rank}</span>
        <span className="absolute inset-0 flex items-center justify-center text-3xl text-red-600">{suit === '♥' ? '♥' : suit === '♦' ? '♦' : suit === '♣' ? '♣' : '♠'}</span>
      </>
    )}
  </motion.div>
);
export const CardBack = ({ className }: { className?: string }) => <Card faceDown className={cn("bg-gradient-to-br from-gray-800 to-gray-900 border border-white/20", className)} />;
