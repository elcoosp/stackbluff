import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';

export const TimerBar = ({ remainingMs }: { remainingMs: number | null }) => {
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
  return <Progress value={progress} className="h-1 bg-muted" indicatorClassName="bg-accent" />;
};
