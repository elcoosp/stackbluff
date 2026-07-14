import { useNavigate, useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Trans, t } from '@lingui/react/macro';

const tabs = [
  { label: t`Cash Games`, path: '/lobby' },
  { label: t`Tournaments`, path: '/tournaments' },
  { label: t`Clubs`, path: '/clubs' },
];

export function LobbyTabs() {
  const navigate = useNavigate();
  const location = useLocation();

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
              : 'text-on-surface-variant hover:text-on-surface'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
