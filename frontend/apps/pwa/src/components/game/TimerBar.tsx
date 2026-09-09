import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TimerBarProps {
  remainingMs: number | null;
  totalMs: number | null;
  isActive?: boolean;
  className?: string;
}

// Interpolates between Green -> Amber -> Neon Red based on progress (100 to 0)
const interpolateColor = (progress: number) => {
  const green = { r: 78, g: 222, b: 163 };
  const amber = { r: 251, g: 191, b: 36 };
  const red = { r: 255, g: 0, b: 60 };

  let color;
  if (progress > 50) {
    // Green to Amber (100% to 50%)
    const t = (100 - progress) / 50;
    color = {
      r: Math.round(green.r + (amber.r - green.r) * t),
      g: Math.round(green.g + (amber.g - green.g) * t),
      b: Math.round(green.b + (amber.b - green.b) * t),
    };
  } else {
    // Amber to Red (50% to 0%)
    const t = (50 - progress) / 50;
    color = {
      r: Math.round(amber.r + (red.r - amber.r) * t),
      g: Math.round(amber.g + (red.g - amber.g) * t),
      b: Math.round(amber.b + (red.b - amber.b) * t),
    };
  }
  return color;
};

export const TimerBar = ({ remainingMs, totalMs, isActive = false, className }: TimerBarProps) => {
  if (remainingMs === null || remainingMs === undefined) return null;

  const total = totalMs || remainingMs;
  const progress = Math.max(0, Math.min(100, (remainingMs / total) * 100));

  const isCritical = progress <= 20 && progress > 0;
  const color = interpolateColor(progress);
  const rgbStr = `${color.r}, ${color.g}, ${color.b}`;

  // Construct the shimmer gradient using the interpolated color
  const shimmerGradient = `linear-gradient(to right, rgba(${rgbStr}, 0.4), rgb(${rgbStr}), rgba(${rgbStr}, 0.4))`;

  return (
    <div className={cn('w-full h-1 rounded-full bg-white/10 overflow-hidden', className)}>
      <motion.div
        className={cn('h-full', isActive && 'animate-shimmer')}
        style={{
          backgroundImage: shimmerGradient, // Must use backgroundImage, NOT background
          backgroundSize: '200% 100%', // Explicitly set size here so animate-shimmer works
        }}
        initial={false}
        animate={{
          width: `${progress}%`,
          boxShadow: isActive
            ? isCritical
              ? `0 0 10px rgb(${rgbStr})`
              : `0 0 4px rgba(${rgbStr}, 0.5)`
            : 'none',
          opacity: isActive ? (isCritical ? [1, 0.4, 1] : 1) : 0.4,
        }}
        transition={{
          width: { duration: 0.1, ease: 'linear' },
          boxShadow: { duration: 0.3 },
          opacity: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
        }}
      />
    </div>
  );
};
