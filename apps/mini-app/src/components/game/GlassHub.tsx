import { cn } from '@/lib/utils';
export const GlassHub = ({ children, active }: { children: React.ReactNode; active?: boolean }) => (
  <div className={cn("glass-hub rounded-xl transition-all", active ? "border-tertiary/60 shadow-[0_0_15px_rgba(78,222,163,0.3)]" : "border-white/10")}>
    {children}
  </div>
);
