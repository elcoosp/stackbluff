import { type ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'emerald' | 'silver';
interface LiquidMetalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}
export const LiquidMetalButton = forwardRef<HTMLButtonElement, LiquidMetalButtonProps>(
  ({ className = '', variant = 'emerald', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`font-label-caps text-sm tracking-[0.2em] px-8 py-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variant === 'emerald' ? 'liquid-metal-emerald' : 'liquid-metal'} ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
);
LiquidMetalButton.displayName = 'LiquidMetalButton';
