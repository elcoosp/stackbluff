import { useEffect, useState } from 'react';
import { MotionProgress } from '@stackbluff/shared/ui/motion-wrappers';
export const TimerBar = ({ remainingMs }: { remainingMs: number | null }) => {
  const [progress, setProgress] = useState(100);
  useEffect(() => {
    if (!remainingMs) return;
    const start = Date.now();
    const interval = setInterval(() => { const elapsed = Date.now() - start; const remaining = Math.max(0, remainingMs - elapsed); setProgress((remaining / remainingMs) * 100); if (remaining <= 0) clearInterval(interval); }, 50);
    return () => clearInterval(interval);
  }, [remainingMs]);
  return <MotionProgress value={progress} className="h-1 bg-muted" indicatorClassName="bg-accent" animate={{ width: `${progress}%` }} transition={{ duration: 0.05 }} />;
};
