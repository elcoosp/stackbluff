import { getPlatform, useUserStore } from '@stackbluff/shared';
import { useEffect } from 'react';
import { CookieConsentBanner } from '@/components/consent/CookieConsentBanner';
import { NotificationPrompt } from '@/components/consent/NotificationPrompt';
import { Header } from '@/components/Header';
import { registerServiceWorker } from '@/lib/serviceWorker';

function App() {
  const { user, loading, loadUser } = useUserStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Register service worker on app startup
  useEffect(() => {
    registerServiceWorker().catch((err) => {
      console.error('Failed to register service worker:', err);
    });
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <Header />

      <div style={{ padding: '2rem' }}>
        <h1>StackBluff PWA</h1>
        {loading && <p>Loading user...</p>}
        {user && (
          <div>
            <p>Welcome, {user.name}!</p>
            <p>Platform: PWA</p>
            <button
              type="button"
              onClick={() =>
                getPlatform().shareContent({
                  title: 'Check out StackBluff',
                  url: window.location.href,
                })
              }
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
          console.log('Notification prompt decision:', decision);
        }}
      />
    </div>
  );
}

export default App;
