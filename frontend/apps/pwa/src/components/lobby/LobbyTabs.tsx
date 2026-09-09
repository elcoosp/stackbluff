import { Trans } from '@lingui/react/macro';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

export function LobbyTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  // Use Trans directly – no t calls at module level
  const tabs = [
    { path: '/lobby', label: <Trans>Cash Games</Trans> },
    { path: '/tournaments', label: <Trans>Tournaments</Trans> },
    { path: '/clubs', label: <Trans>Clubs</Trans> },
  ];

  return (
    <div className="flex gap-1 bg-surface-container p-1 rounded-xl border border-outline-variant self-start md:self-auto">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          onClick={() => navigate({ to: tab.path })}
          className={cn(
            'px-3 md:px-6 py-1.5 md:py-2 rounded-lg font-label-caps text-xs md:text-sm transition-all',
            location.pathname === tab.path
              ? 'bg-surface-container-highest text-tertiary'
              : 'text-on-surface-variant hover:text-on-surface',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
