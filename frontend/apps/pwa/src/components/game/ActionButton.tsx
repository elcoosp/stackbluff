import { Check, FoldHorizontal, Skull, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ActionButton = ({
  variant,
  children,
  onClick,
  disabled,
  shortcut,
  isMobile,
}: {
  variant: 'fold' | 'call' | 'raise' | 'all-in';
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
  isMobile?: boolean;
}) => {
  const Icon =
    variant === 'fold'
      ? FoldHorizontal
      : variant === 'call'
        ? Check
        : variant === 'raise'
          ? TrendingUp
          : Skull;

  if (isMobile) {
    const mobileStyles: Record<string, string> = {
      fold: 'border border-red-500/30 text-red-400/80 bg-transparent active:bg-red-500/10',
      call: 'bg-tertiary text-on-tertiary shadow-md shadow-tertiary/20 font-extrabold',
      raise: 'liquid-metal',
      'all-in': 'liquid-metal-emerald',
    };

    return (
      <button
        className={cn(
          'w-full flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-[11px] uppercase whitespace-nowrap transition-all active:scale-[0.97] disabled:opacity-25 disabled:pointer-events-none',
          mobileStyles[variant],
        )}
        style={{ letterSpacing: '0.06em' }}
        onClick={onClick}
        disabled={disabled}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {children}
      </button>
    );
  }

  // Desktop
  const desktopStyles: Record<string, string> = {
    fold: 'border border-red-500/40 text-red-400 hover:bg-red-500/10 active:bg-red-500/15',
    call: 'bg-tertiary text-on-tertiary hover:bg-tertiary/85 active:bg-tertiary/75 shadow-lg shadow-tertiary/20 font-extrabold px-5',
    raise: 'liquid-metal',
    'all-in': 'liquid-metal-emerald',
  };

  return (
    <button
      className={cn(
        'px-4 py-2.5 rounded-full font-bold text-xs uppercase tracking-[0.1em] flex items-center gap-1.5 whitespace-nowrap transition-all active:scale-95 disabled:opacity-25 disabled:pointer-events-none',
        desktopStyles[variant],
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{children}</span>
      {shortcut && (
        <kbd className="ml-1 px-1.5 py-0.5 rounded text-[8px] font-mono border border-current/20 opacity-35 leading-none">
          {shortcut}
        </kbd>
      )}
    </button>
  );
};
