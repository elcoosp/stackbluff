import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { NotificationPreferences } from '@/components/settings/NotificationPreferences';
import { NotificationsSettings } from '@/components/settings/NotificationsSettings';

export const Route = createFileRoute('/settings/notifications')({
  component: NotificationsSettingsPage,
});

function NotificationsSettingsPage() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Sign In Required</h2>
          <p className="text-on-surface-variant text-sm">Please sign in to manage your notifications.</p>
          <Link to="/login" className="mt-4 inline-block">
            <Button>Sign In</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/settings" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-2xl text-on-surface flex items-center gap-2"><Bell className="w-6 h-6 text-tertiary" />Notification Settings</h1>
      </div>

      <NotificationPreferences />
      <NotificationsSettings />
    </div>
  );
}
