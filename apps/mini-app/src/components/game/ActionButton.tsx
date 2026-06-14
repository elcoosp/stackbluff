import { MotionButton } from '@stackbluff/shared/ui/motion-wrappers';
import { cn } from '@/lib/utils';
export const ActionButton = ({ variant, children, onClick, disabled }: { variant: 'fold' | 'call' | 'raise' | 'all-in'; children: React.ReactNode; onClick: () => void; disabled?: boolean }) => {
  const styles = { fold: "bg-destructive text-destructive-foreground hover:bg-destructive/80", call: "bg-accent text-accent-foreground hover:bg-accent/80", raise: "border border-primary text-primary hover:bg-primary/10", "all-in": "border border-destructive text-destructive hover:bg-destructive/10" };
  return <MotionButton className={cn("px-4 py-2 rounded-full font-bold", styles[variant])} whileTap={{ scale: 0.92 }} onClick={onClick} disabled={disabled}>{children}</MotionButton>;
};
