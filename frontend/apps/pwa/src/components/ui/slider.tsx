import * as React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}
const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ value = [0], onValueChange, min = 0, max = 100, step = 1, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = Number(e.target.value);
      onValueChange?.([newVal]);
    };
    return (
      <input
        type="range"
        ref={ref}
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={handleChange}
        className={cn(
          'w-full h-2 rounded-full appearance-none cursor-pointer accent-tertiary bg-white/[0.06] border border-white/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]',
          className,
        )}
        {...props}
      />
    );
  },
);
Slider.displayName = 'Slider';

export { Slider };
