import { forwardRef, ButtonHTMLAttributes } from 'react';
export const LiquidMetalButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={`bg-gradient-to-br from-primary to-secondary text-on-primary font-label-caps text-sm tracking-[0.2em] px-8 py-4 rounded-lg hover:brightness-110 active:scale-95 transition-all duration-200 shadow-[0_4px_20px_rgba(0,0,0,0.4)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);
LiquidMetalButton.displayName = 'LiquidMetalButton';
