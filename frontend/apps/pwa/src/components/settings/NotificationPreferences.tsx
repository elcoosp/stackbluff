import { useState, useEffect } from 'react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared/api/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Bell } from 'lucide-react';

interface NotificationSettings {
  tournamentReminder60: boolean;
  tournamentReminder10: boolean;
  tournamentResults: boolean;
  clubAnnouncements: boolean;
  friendActivity: boolean;
  promotional: boolean;
}

const STORAGE_KEY = 'stackbluff-notification-preferences';
const DEFAULTS: NotificationSettings = {
  tournamentReminder60: true,
  tournamentReminder10: true,
  tournamentResults: true,
  clubAnnouncements: true,
  friendActivity: true,
  promotional: false,
};

function loadSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(settings: NotificationSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function NotificationPreferences() {
  const { isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch preferences from backend
  const { data: remoteSettings, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => apiClient<NotificationSettings>('/notifications/preferences'),
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: 1,
  });

  // Load settings on mount (local first, then remote)
  useEffect(() => {
    const local = loadSettings();
    if (remoteSettings) {
      setSettings({ ...local, ...remoteSettings });
    } else {
      setSettings(local);
    }
  }, [remoteSettings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data: NotificationSettings) =>
      apiClient('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setIsSaving(false);
      setIsDirty(false);
      saveSettings(settings);
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Notification preferences saved');
    },
    onError: (error) => {
      setIsSaving(false);
      toast.error(error instanceof Error ? error.message : 'Failed to save preferences');
    },
  });

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      setIsDirty(true);
      return next;
    });
  };

  const handleSave = () => {
    if (!isDirty) return;
    setIsSaving(true);
    saveMutation.mutate(settings);
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
    setIsDirty(true);
  };

  if (isLoading) {
    return (
      <section className="p-6 rounded-xl bg-white/5 border border-white/10">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Bell className="w-5 h-5 text-tertiary" />
          Notification Preferences
        </h3>
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="p-6 rounded-xl bg-white/5 border border-white/10">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Bell className="w-5 h-5 text-tertiary" />
        Notification Preferences
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        Choose which notifications you receive. Changes are saved to your account.
      </p>

      <div className="space-y-3">
        <ToggleRow
          label="60-minute tournament reminder"
          description="Get notified 1 hour before a tournament starts"
          checked={settings.tournamentReminder60}
          onChange={() => handleToggle('tournamentReminder60')}
        />
        <ToggleRow
          label="10-minute tournament reminder"
          description="Get notified 10 minutes before a tournament starts"
          checked={settings.tournamentReminder10}
          onChange={() => handleToggle('tournamentReminder10')}
        />
        <ToggleRow
          label="Tournament results"
          description="Get notified when tournaments you played in finish"
          checked={settings.tournamentResults}
          onChange={() => handleToggle('tournamentResults')}
        />
        <ToggleRow
          label="Club announcements"
          description="Receive club tournament and event announcements"
          checked={settings.clubAnnouncements}
          onChange={() => handleToggle('clubAnnouncements')}
        />
        <ToggleRow
          label="Friend activity"
          description="Get notified when friends are online or play hands"
          checked={settings.friendActivity}
          onChange={() => handleToggle('friendActivity')}
        />
        <ToggleRow
          label="Promotional"
          description="Receive special offers and updates about new features"
          checked={settings.promotional}
          onChange={() => handleToggle('promotional')}
        />
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
        <Button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="bg-tertiary text-on-tertiary hover:bg-tertiary/80"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!isDirty}
          className="border-white/10 text-on-surface-variant hover:text-on-surface"
        >
          Reset to Defaults
        </Button>
      </div>

      {!isAuthenticated && (
        <p className="text-xs text-on-surface-variant/50 mt-4">
          Sign in to sync your preferences across devices.
        </p>
      )}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div>
        <span className="text-sm text-on-surface">{label}</span>
        <p className="text-xs text-on-surface-variant">{description}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-tertiary focus:ring-offset-2 flex-shrink-0
          ${checked ? 'bg-tertiary' : 'bg-white/20'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </label>
  );
}
