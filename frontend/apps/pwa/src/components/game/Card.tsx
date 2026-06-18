import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps {
  rank?: string;
  suit?: string;
  faceDown?: boolean;
  className?: string;
  rounded?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  hoverable?: boolean;
}

export const Card = ({
  rank,
  suit,
  faceDown,
  className,
  rounded = 'rounded-sm',
  size = 'md',
  hoverable = true,
}: CardProps) => {
  const isRed = suit === '♥' || suit === '♦';
  const suitColor = isRed ? '#e11d48' : '#1e293b';

  const renderFront = () => (
    <div
      className={cn(
        'relative bg-white shadow-[0_4px_12px_rgba(0,0,0,0.5),0_1px_4px_rgba(0,0,0,0.2)]',
        rounded,
        className
      )}
      style={{
        aspectRatio: '5/7',
        containerType: 'inline-size' // Allows internal elements to scale responsively using cqw
      }}
    >
      <div
        className="absolute top-0 left-0 flex flex-col items-center leading-none p-[10%]"
      >
        <span className="font-bold" style={{ color: suitColor, fontSize: '25cqw' }}>
          {rank}
        </span>
        <span className="font-bold" style={{ color: suitColor, fontSize: '20cqw' }}>
          {suit}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-[10%] flex items-center justify-center pointer-events-none">
        <span className="leading-none" style={{ color: suitColor, fontSize: '55cqw' }}>
          {suit}
        </span>
      </div>
    </div>
  );

  const renderBack = () => (
    <div
      className={cn(
        'relative overflow-hidden border border-white/30 shadow-[0_4px_12px_rgba(0,0,0,0.5),0_1px_4px_rgba(0,0,0,0.2)]',
        rounded,
        className
      )}
      style={{
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
        aspectRatio: '5/7',
        containerType: 'inline-size'
      }}
    >
      <div className={cn('absolute inset-[10%] border border-white/10', rounded)} />
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
      {/* Sharp corner accents with radius ONLY on the intersecting corner */}
      <div className="absolute top-[10%] left-[10%] w-[10%] h-[10%] border-t border-l border-white/15 rounded-tl-sm" />
      <div className="absolute bottom-[10%] right-[10%] w-[10%] h-[10%] border-b border-r border-white/15 rounded-br-sm" />
    </div>
  );

  return (
    <motion.div
      {...(hoverable
        ? { whileHover: { y: -4, transition: { type: 'spring', stiffness: 300 } } }
        : {})}
      className={cn(rounded)}
    >
      {faceDown ? renderBack() : renderFront()}
    </motion.div>
  );
};

export const CardBack = ({
  className,
  rounded = 'rounded-sm',
  size = 'md',
  hoverable = true,
}: {
  className?: string;
  rounded?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  hoverable?: boolean;
}) => <Card faceDown className={className} rounded={rounded} size={size} hoverable={hoverable} />;
