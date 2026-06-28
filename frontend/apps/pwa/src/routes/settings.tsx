import { createFileRoute } from '@tanstack/react-router';
import { NotificationsSettings } from '@/components/settings/NotificationsSettings';

/**
 * Settings page route – user preferences and account management.
 * Issue #006 created this page; #036 adds the notifications section.
 */
function SettingsPage() {
  return (
    <div
      style={{
        maxWidth: '48rem',
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff',
      }}
    >
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        ⚙️ Settings
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <NotificationsSettings />

        {/* Additional settings sections will be added here */}
      </div>
    </div>
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});
