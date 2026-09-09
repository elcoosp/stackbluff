import { Trans } from '@lingui/react/macro';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { NotificationPreferences } from '@/components/settings/NotificationPreferences';
import { NotificationsSettings } from '@/components/settings/NotificationsSettings';

export const Route = createFileRoute('/settings/notifications')({
  component: NotificationsSettingsPage,
});

function NotificationsSettingsPage() {
  const {} = useAuthStore();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/settings" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-2xl text-on-surface flex items-center gap-2">
          <Trans>Notification Settings</Trans>
        </h1>
      </div>

      <NotificationPreferences />
      <NotificationsSettings />
    </div>
  );
}
