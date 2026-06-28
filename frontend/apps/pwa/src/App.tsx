import { getPlatform, useUserStore } from '@stackbluff/shared';
import { useEffect } from 'react';
import { CookieConsentBanner } from '@/components/consent/CookieConsentBanner';
import { NotificationPrompt } from '@/components/consent/NotificationPrompt';
import { registerServiceWorker, cleanupServiceWorker } from '@/lib/serviceWorker';
import { logger } from '@/lib/logger';

const appLogger = logger.child({ component: 'App' });

function App() {
  const { user, loading, loadUser } = useUserStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Register service worker on app startup (with cleanup)
  useEffect(() => {
    appLogger.info('Initializing app');

    registerServiceWorker().catch((err) => {
      appLogger.error('Failed to register service worker', err);
    });

    // Cleanup on unmount
    return () => {
      appLogger.info('Cleaning up app');
      cleanupServiceWorker();
    };
  }, []);

  return (
    <div className="font-sans">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">StackBluff PWA</h1>
        {loading && <p className="text-gray-400">Loading user...</p>}
        {user && (
          <div className="space-y-2">
            <p className="text-lg">Welcome, {user.name}!</p>
            <p className="text-sm text-gray-400">Platform: PWA</p>
            <button
              type="button"
              onClick={() =>
                getPlatform().shareContent({
                  title: 'Check out StackBluff',
                  url: window.location.href,
                })
              }
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Share
            </button>
          </div>
        )}
      </div>

      {/* Consent components */}
      <CookieConsentBanner />
      <NotificationPrompt
        onDecision={(decision) => {
          appLogger.info('Notification prompt decision', { decision });
        }}
      />
    </div>
  );
}

export default App;
