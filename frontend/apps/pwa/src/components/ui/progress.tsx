import * as React from 'react';
import { cn } from '../../lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indicatorClassName?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorClassName, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06] border border-white/[0.06] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]', className)}
      {...props}
    >
      <div
        className={cn(
          'h-full w-full flex-1 bg-gradient-to-r from-tertiary to-tertiary-fixed shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all',
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  ),
);
Progress.displayName = 'Progress';

export { Progress };
