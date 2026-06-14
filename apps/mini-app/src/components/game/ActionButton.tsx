import { MotionButton } from '@stackbluff/shared/ui/motion-wrappers';
import { cn } from '@/lib/utils';
export const ActionButton = ({ variant, children, onClick, disabled }: { variant: 'fold' | 'call' | 'raise' | 'all-in'; children: React.ReactNode; onClick: () => void; disabled?: boolean }) => {
  const styles = {
    fold: "border border-destructive text-destructive hover:bg-destructive/10",
    call: "bg-tertiary text-on-tertiary hover:bg-tertiary/80 shadow-lg",
    raise: "border border-primary text-primary hover:bg-primary/10",
    "all-in": "border border-destructive text-destructive hover:bg-destructive/10"
  };
  return <MotionButton className={cn("px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wider", styles[variant])} whileTap={{ scale: 0.95 }} onClick={onClick} disabled={disabled}>{children}</MotionButton>;
};
