import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { getPlatform, useUserStore } from '@stackbluff/shared';
import { clubWebSocket } from '@stackbluff/shared/lib/websocket';
import { useEffect } from 'react';
import { CookieConsentBanner } from '@/components/consent/CookieConsentBanner';
import { NotificationPrompt } from '@/components/consent/NotificationPrompt';
import { logger } from '@/lib/logger';
import { ErrorBoundary } from '@/lib/sentry';
import { cleanupServiceWorker, registerServiceWorker } from '@/lib/serviceWorker';

const appLogger = logger.child({ component: 'App' });

function App() {
  const { user, loading, loadUser } = useUserStore();

  useEffect(() => {
    loadUser();
    clubWebSocket.connect();
  }, [loadUser]);

  useEffect(() => {
    appLogger.info('Initializing app');
    registerServiceWorker().catch((err) => {
      appLogger.error('Failed to register service worker', err);
    });
    return () => {
      appLogger.info('Cleaning up app');
      cleanupServiceWorker();
    };
  }, []);

  return (
    <ErrorBoundary
      fallback={
        <div className="p-8 text-center text-red-400">
          <Trans>Something went wrong</Trans>
        </div>
      }
    >
      <div className="font-sans">
        <div className="p-8">
          <h1 className="text-3xl font-bold mb-4">
            <Trans>StackBluff PWA</Trans>
          </h1>
          {loading && (
            <p className="text-gray-400">
              <Trans>Loading user...</Trans>
            </p>
          )}
          {user && (
            <div className="space-y-2">
              <p className="text-lg">
                <Trans>Welcome, {user.name}!</Trans>
              </p>
              <p className="text-sm text-gray-400">
                <Trans>Platform: PWA</Trans>
              </p>
              <button
                type="button"
                onClick={() =>
                  getPlatform().shareContent({
                    title: t`Check out StackBluff`,
                    url: window.location.href,
                  })
                }
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Trans>Share</Trans>
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
        />{' '}
      </div>
    </ErrorBoundary>
  );
}

export default App;
