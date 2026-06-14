import { ReactNode } from 'react';
export const GlassPanel = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`backdrop-blur-2xl bg-black/60 border border-white/10 rounded-lg p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden ${className}`}>
    <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-primary/40" />
    <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-primary/40" />
    {children}
  </div>
);
