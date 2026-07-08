import { useState, useEffect } from 'react';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';

interface NotificationSettings {
  tournamentReminder60: boolean;
  tournamentReminder10: boolean;
  tournamentResults: boolean;
  clubAnnouncements: boolean;
}

const STORAGE_KEY = 'stackbluff-notification-preferences';
const DEFAULTS: NotificationSettings = {
  tournamentReminder60: true,
  tournamentReminder10: true,
  tournamentResults: true,
  clubAnnouncements: true,
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
  const user = useAuthStore((s) => s.user);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);

  // Load settings on mount
  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSettings(next);
      return next;
    });
  };

  return (
    <section className="p-6 rounded-xl bg-white/5 border border-white/10">
      <h3 className="text-lg font-semibold mb-2">🔔 Tournament Notifications</h3>
      <p className="text-sm text-gray-400 mb-4">
        Choose which tournament-related notifications you receive.
      </p>

      <div className="space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-sm text-on-surface">60-minute reminder</span>
            <p className="text-xs text-on-surface-variant">Get notified 1 hour before a tournament starts</p>
          </div>
          <Toggle checked={settings.tournamentReminder60} onChange={() => handleToggle('tournamentReminder60')} />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-sm text-on-surface">10-minute reminder</span>
            <p className="text-xs text-on-surface-variant">Get notified 10 minutes before a tournament starts</p>
          </div>
          <Toggle checked={settings.tournamentReminder10} onChange={() => handleToggle('tournamentReminder10')} />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-sm text-on-surface">Tournament results</span>
            <p className="text-xs text-on-surface-variant">Get notified when tournaments you played in finish</p>
          </div>
          <Toggle checked={settings.tournamentResults} onChange={() => handleToggle('tournamentResults')} />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-sm text-on-surface">Club announcements</span>
            <p className="text-xs text-on-surface-variant">Receive club tournament and event announcements</p>
          </div>
          <Toggle checked={settings.clubAnnouncements} onChange={() => handleToggle('clubAnnouncements')} />
        </label>
      </div>

      {!user && (
        <p className="text-xs text-on-surface-variant/50 mt-4">
          Sign in to sync your preferences across devices.
        </p>
      )}
    </section>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-tertiary focus:ring-offset-2
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
  );
}
