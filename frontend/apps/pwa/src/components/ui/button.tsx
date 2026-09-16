import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';
    const variants = {
      default:
        'bg-gradient-to-b from-tertiary to-tertiary-container text-on-tertiary shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_8px_24px_rgba(16,185,129,0.25)] hover:from-tertiary-fixed hover:to-tertiary hover:shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_10px_28px_rgba(16,185,129,0.35)]',
      destructive:
        'bg-destructive text-destructive-foreground shadow-lg shadow-red-950/40 hover:bg-destructive/90',
      outline:
        'border border-outline-variant/80 text-on-surface bg-transparent hover:border-tertiary/50 hover:text-tertiary hover:bg-tertiary/10 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]',
      secondary:
        'bg-white/5 text-on-surface border border-white/10 border-t-white/15 backdrop-blur-sm hover:bg-white/10',
      ghost:
        'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06]',
      link: 'underline-offset-4 hover:underline text-tertiary',
    };
    const sizes = {
      default: 'h-10 py-2 px-4',
      sm: 'h-9 px-3 rounded-lg',
      lg: 'h-11 px-8 rounded-lg',
      icon: 'h-10 w-10',
    };
    return (
      <button
        className={cn(base, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
