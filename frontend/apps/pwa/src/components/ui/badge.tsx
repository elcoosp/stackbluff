import type * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantClasses = {
    default:
      'bg-tertiary/20 text-tertiary border-tertiary/30 shadow-[0_0_8px_rgba(16,185,129,0.1)] hover:bg-tertiary/30',
    secondary: 'bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10',
    destructive: 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25',
    outline: 'text-on-surface-variant border-outline-variant/60 hover:bg-white/5',
  };
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
