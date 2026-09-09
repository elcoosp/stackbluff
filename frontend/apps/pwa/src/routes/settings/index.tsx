import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { createFileRoute, Link, Outlet, useMatches } from '@tanstack/react-router';
import {
  Bell,
  ChevronRight,
  CreditCard,
  Palette,
  Send,
  Settings,
  Shield,
  User,
  Volume2,
} from 'lucide-react';

function SettingsPage() {
  const matches = useMatches();
  const currentRouteId = matches[matches.length - 1]?.routeId;
  const isIndex = currentRouteId === '/settings';

  // If we're on a child route, render the outlet (child content)
  if (!isIndex) {
    return <Outlet />;
  }

  // Otherwise render the settings list (index)
  const settingsSections = [
    {
      title: t`Account`,
      description: t`Manage your profile, password, and email`,
      icon: User,
      to: '/settings/account',
    },
    {
      title: t`Notifications`,
      description: t`Push notifications and alert preferences`,
      icon: Bell,
      to: '/settings/notifications',
    },
    {
      title: t`Appearance`,
      description: t`Theme, felt color, and visual preferences`,
      icon: Palette,
      to: '/settings/appearance',
    },
    {
      title: t`Audio`,
      description: t`Sound effects, music, and haptics`,
      icon: Volume2,
      to: '/settings/audio',
    },
    {
      title: t`Privacy & Data`,
      description: t`GDPR, data export, and account deletion`,
      icon: Shield,
      to: '/settings/privacy',
    },
    {
      title: t`Payments`,
      description: t`Purchase history and invoices`,
      icon: CreditCard,
      to: '/settings/payments',
    },
    {
      title: t`Telegram`,
      description: t`Link your Telegram account for notifications`,
      icon: Send,
      to: '/settings/telegram',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display-lg text-3xl text-on-surface flex items-center gap-2">
          <Settings className="w-8 h-8 text-tertiary" />
          <Trans>Settings</Trans>
        </h1>
        <Link
          to="/profile"
          className="text-sm text-tertiary hover:text-tertiary/80 transition-colors flex items-center gap-1"
        >
          <User className="w-4 h-4" />
          <Trans>Profile</Trans>
        </Link>
      </div>

      <div className="space-y-3">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.to}
              to={section.to}
              className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-tertiary/30 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/5 rounded-lg">
                  <Icon className="w-5 h-5 text-tertiary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-on-surface group-hover:text-tertiary transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-xs text-on-surface-variant">{section.description}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-tertiary transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export const Route = createFileRoute('/settings/')({
  component: SettingsPage,
});
