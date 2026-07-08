import { createFileRoute, Link } from '@tanstack/react-router';
import { NotificationsSettings } from '@/components/settings/NotificationsSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { NotificationPreferences } from '@/components/settings/NotificationPreferences';

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
        <NotificationPreferences />

        <NotificationsSettings />

        <AccountSettings />


        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <h3 className="text-sm font-semibold text-on-surface">Privacy & Data</h3>
          <p className="text-xs text-on-surface-variant mt-1">Manage your data and account deletion.</p>
          <Link to="/settings/privacy" className="text-tertiary text-sm font-medium hover:underline mt-2 inline-block">
            Manage Privacy →
          </Link>
        
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <h3 className="text-sm font-semibold text-on-surface">Payments</h3>
          <p className="text-xs text-on-surface-variant mt-1">View your purchase history and invoices.</p>
          <Link to="/settings/payments" className="text-tertiary text-sm font-medium hover:underline mt-2 inline-block">
            View Purchase History →
          </Link>
        </div>
      </div>
      
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <h3 className="text-sm font-semibold text-on-surface">Payments</h3>
          <p className="text-xs text-on-surface-variant mt-1">View your purchase history and invoices.</p>
          <Link to="/settings/payments" className="text-tertiary text-sm font-medium hover:underline mt-2 inline-block">
            View Purchase History →
          </Link>
        </div>
      </div>
    
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <h3 className="text-sm font-semibold text-on-surface">Payments</h3>
          <p className="text-xs text-on-surface-variant mt-1">View your purchase history and invoices.</p>
          <Link to="/settings/payments" className="text-tertiary text-sm font-medium hover:underline mt-2 inline-block">
            View Purchase History →
          </Link>
        </div>
      </div>
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});
