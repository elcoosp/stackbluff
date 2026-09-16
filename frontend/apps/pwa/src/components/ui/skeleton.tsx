import * as React from 'react';
import { cn } from '@/lib/utils';

const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-md bg-white/[0.04] relative overflow-hidden', className)}
      {...props}
    >
      <div className="absolute inset-0 shimmer-bar" aria-hidden="true" />
    </div>
  ),
);
Skeleton.displayName = 'Skeleton';

export { Skeleton };