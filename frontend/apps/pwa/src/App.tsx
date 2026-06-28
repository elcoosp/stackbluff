import { getPlatform, useUserStore } from '@stackbluff/shared';
import { useEffect } from 'react';
import { CookieConsentBanner } from '@/components/consent/CookieConsentBanner';

function App() {
  const { user, loading, loadUser } = useUserStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
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
      <CookieConsentBanner />
    </div>
  );
}

export default App;
