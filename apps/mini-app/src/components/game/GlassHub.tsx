import { cn } from '@/lib/utils';
export const GlassHub = ({ children, active }: { children: React.ReactNode; active?: boolean }) => (
  <div className={cn("backdrop-blur-md bg-black/60 rounded-lg border transition-all", active ? "border-accent/60 shadow-[0_0_15px_rgba(78,222,163,0.3)]" : "border-white/10")}>
    {children}
  </div>
);
