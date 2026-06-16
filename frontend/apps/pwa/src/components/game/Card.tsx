import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps {
  rank?: string;
  suit?: string;
  faceDown?: boolean;
  className?: string;
  rounded?: string;
}

export const Card = ({
  rank,
  suit,
  faceDown,
  className,
  rounded = 'rounded-[2px]', // minimal radius
}: CardProps) => {
  // Front of card (face up)
  const renderFront = () => (
    <div
      className={cn(
        'relative bg-white shadow-[0_8px_25px_rgba(0,0,0,0.8),0_2px_8px_rgba(0,0,0,0.4)]',
        rounded,
        className
      )}
    >
      <span className="absolute top-2 left-2 text-2xl font-bold text-error-container">{rank}</span>
      <span className="absolute bottom-2 right-2 text-2xl font-bold text-error-container rotate-180">{rank}</span>
      <span
        className="absolute inset-0 flex items-center justify-center text-6xl"
        style={{ color: suit === '♥' || suit === '♦' ? '#e11d48' : '#1e293b' }}
      >
        {suit === '♥' ? '♥' : suit === '♦' ? '♦' : suit === '♣' ? '♣' : '♠'}
      </span>
    </div>
  );

  // Back of card – with slim white border and minimal radius
  const renderBack = () => (
    <div
      className={cn(
        'relative overflow-hidden border border-white/30 shadow-[0_8px_25px_rgba(0,0,0,0.8),0_2px_8px_rgba(0,0,0,0.4)]',
        rounded,
        className
      )}
      style={{
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
      }}
    >
      <div className="absolute inset-[3px] border border-white/10 rounded-[inherit]" />
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            rgba(78, 222, 163, 0.15) 2px,
            rgba(78, 222, 163, 0.15) 4px
          )`,
        }}
      />
      <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-white/10" />
      <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-white/10" />
    </div>
  );

  return (
    <motion.div
      whileHover={{ y: -6, transition: { type: 'spring', stiffness: 300 } }}
      className="shadow-[0_12px_35px_rgba(0,0,0,0.9)]"
    >
      {faceDown ? renderBack() : renderFront()}
    </motion.div>
  );
};

export const CardBack = ({
  className,
  rounded = 'rounded-[2px]',
}: {
  className?: string;
  rounded?: string;
}) => <Card faceDown className={className} rounded={rounded} />;
