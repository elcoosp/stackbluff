// frontend/apps/pwa/src/components/game/TimerBar.tsx
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface TimerBarProps {
  remainingMs: number | null;
  isActive?: boolean;
  className?: string;
}

export const TimerBar = ({ remainingMs, isActive = false, className }: TimerBarProps) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!remainingMs) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, remainingMs - elapsed);
      setProgress((remaining / remainingMs) * 100);
      if (remaining <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [remainingMs]);

  if (!remainingMs) return null;

  return (
    <div className={cn('w-full h-1 rounded-full bg-white/10 overflow-hidden', className)}>
      <div
        className={cn(
          'h-full transition-all duration-100',
          isActive
            ? 'bg-gradient-to-r from-tertiary/40 via-tertiary to-tertiary/40 bg-[length:200%_100%] animate-shimmer'
            : 'bg-tertiary/40'
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
