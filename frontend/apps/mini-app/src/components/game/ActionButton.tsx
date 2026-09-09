import { Check, FoldHorizontal, Skull, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const ActionButton = ({
  variant,
  children,
  onClick,
  disabled,
}: {
  variant: 'fold' | 'call' | 'raise' | 'all-in';
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => {
  const styles = {
    fold: 'border border-destructive text-destructive hover:bg-destructive/10',
    call: 'bg-tertiary text-on-tertiary hover:bg-tertiary/80 shadow-lg',
    raise: 'border border-primary text-primary hover:bg-primary/10',
    'all-in': 'border border-destructive text-destructive hover:bg-destructive/10',
  };
  const Icon =
    variant === 'fold'
      ? FoldHorizontal
      : variant === 'call'
        ? Check
        : variant === 'raise'
          ? TrendingUp
          : Skull;
  return (
    <Button
      className={cn(
        'px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95',
        styles[variant],
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="w-4 h-4" />
      {children}
    </Button>
  );
};
