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
  isWinning?: boolean;
  isLosing?: boolean;
}

export const Card = ({
  rank,
  suit,
  faceDown,
  className,
  rounded = 'rounded-sm',
  size: _size = 'md',
  hoverable = true,
  isWinning = false,
  isLosing = false,
}: CardProps) => {
  const isRed = suit === '♥' || suit === '♦';
  const suitColor = isRed ? '#e11d48' : '#1e293b';

  // Static filters – no animation
  const baseFilter = 'grayscale(0) brightness(1)';
  const losingFilter = 'grayscale(0.8) brightness(0.5)';
  const winningFilter = 'grayscale(0) brightness(1.1)';

  // Box shadows for drop-shadow and glow
  const baseShadow = '0 4px 12px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.2)';
  const winningShadowLow = '0 4px 12px rgba(0,0,0,0.5), 0 0 12px rgba(78,222,163,0.5)';
  const winningShadowHigh = '0 4px 12px rgba(0,0,0,0.5), 0 0 24px rgba(78,222,163,0.7)';
  const losingShadow = '0 4px 8px rgba(0,0,0,0.7)';

  const renderFront = () => (
    <div
      className={cn('relative bg-white', rounded, className)}
      style={{
        aspectRatio: '5/7',
        containerType: 'inline-size',
      }}
    >
      <div className="absolute top-0 left-0 flex flex-col items-center leading-none p-[10%]">
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
      className={cn('relative overflow-hidden border border-white/30', rounded, className)}
      style={{
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
        aspectRatio: '5/7',
        containerType: 'inline-size',
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
      <div className="absolute top-[10%] left-[10%] w-[10%] h-[10%] border-t border-l border-white/15 rounded-tl-sm" />
      <div className="absolute bottom-[10%] right-[10%] w-[10%] h-[10%] border-b border-r border-white/15 rounded-br-sm" />
    </div>
  );

  // Determine animation state
  let filter = baseFilter;
  let boxShadow = baseShadow;
  let animateProps: Record<string, unknown> = {};
  let transitionProps: Record<string, unknown> = {};

  if (isLosing) {
    filter = losingFilter;
    boxShadow = losingShadow;
    animateProps = { scale: 0.98 };
    transitionProps = { duration: 0.5, ease: [0.22, 1, 0.36, 1] };
  } else if (isWinning) {
    filter = winningFilter;
    // Animate boxShadow between two glow levels
    animateProps = {
      boxShadow: [winningShadowLow, winningShadowHigh, winningShadowLow],
      scale: 1,
    };
    transitionProps = {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    };
  } else {
    // Normal state – no animation
    animateProps = {};
    transitionProps = {};
  }

  return (
    <motion.div
      {...(hoverable && !isWinning && !isLosing
        ? { whileHover: { y: -4, transition: { type: 'spring', stiffness: 300 } } }
        : {})}
      style={{
        filter,
        boxShadow,
      }}
      animate={animateProps}
      transition={transitionProps}
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
