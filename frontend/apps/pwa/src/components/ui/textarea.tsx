import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] bg-black/30 backdrop-blur-md px-3 py-2 text-sm text-on-surface ring-offset-black placeholder:text-on-surface-variant/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/60 focus-visible:border-tertiary/40 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
