import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps {
  rank?: string;
  suit?: string;
  faceDown?: boolean;
  className?: string;
  rounded?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Card = ({
  rank,
  suit,
  faceDown,
  className,
  rounded = 'rounded-sm', // less radius
  size = 'md',
}: CardProps) => {
  const rankSize = {
    xs: 'text-[6px]',
    sm: 'text-[8px]',
    md: 'text-[11px]',
    lg: 'text-[14px]',
    xl: 'text-[18px]',
  }[size];

  const pipSize = {
    xs: 'text-[5px]',
    sm: 'text-[6px]',
    md: 'text-[8px]',
    lg: 'text-[10px]',
    xl: 'text-[13px]',
  }[size];

  const suitSize = {
    xs: 'text-[14px]',
    sm: 'text-[20px]',
    md: 'text-[34px]',
    lg: 'text-[44px]',
    xl: 'text-[56px]',
  }[size];

  const cornerPadding = {
    xs: 'p-0.5',
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
    xl: 'p-3',
  }[size];

  const isRed = suit === '♥' || suit === '♦';
  const suitColor = isRed ? '#e11d48' : '#1e293b';

  const renderFront = () => (
    <div
      className={cn(
        'relative bg-white shadow-[0_8px_25px_rgba(0,0,0,0.8),0_2px_8px_rgba(0,0,0,0.4)]',
        rounded,
        className
      )}
      style={{ aspectRatio: '5/7' }}
    >
      {/* Top-left corner: rank + pip */}
      <div
        className={cn(
          'absolute top-0 left-0 flex flex-col items-center leading-none',
          cornerPadding
        )}
      >
        <span className={`font-bold ${rankSize}`} style={{ color: suitColor }}>
          {rank}
        </span>
        <span className={`font-bold ${pipSize}`} style={{ color: suitColor }}>
          {suit}
        </span>
      </div>

      {/* Center suit – positioned at the bottom */}
      <div className="absolute inset-x-0 bottom-[10%] flex items-center justify-center pointer-events-none">
        <span className={`${suitSize} leading-none`} style={{ color: suitColor }}>
          {suit}
        </span>
      </div>
    </div>
  );

  const renderBack = () => (
    <div
      className={cn(
        'relative overflow-hidden border border-white/30 shadow-[0_8px_25px_rgba(0,0,0,0.8),0_2px_8px_rgba(0,0,0,0.4)]',
        rounded,
        className
      )}
      style={{
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
        aspectRatio: '5/7',
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
    <motion.div className="shadow-[0_12px_35px_rgba(0,0,0,0.9)]">
      {faceDown ? renderBack() : renderFront()}
    </motion.div>
  );
};

export const CardBack = ({
  className,
  rounded = 'rounded-sm',
  size = 'md',
}: {
  className?: string;
  rounded?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) => <Card faceDown className={className} rounded={rounded} size={size} />;
