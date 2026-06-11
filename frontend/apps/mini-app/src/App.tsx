import { getPlatform, useUserStore } from '@stackbluff/shared';
import { LobbyPage } from "./pages/LobbyPage";
import { useEffect } from 'react';
import { LobbyPage } from "./pages/LobbyPage";

function App() {
  const { user, loading, loadUser } = useUserStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const platform = getPlatform();
    if (platform.isInApp()) {
      console.log('Mini App running inside Telegram');
    }
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>StackBluff Mini App</h1>
      {loading && <p>Loading user...</p>}
      {user && (
        <div>
          <p>Welcome, {user.name}!</p>
          <p>Platform: {user.isTelegram ? 'Telegram' : 'Web'}</p>
          <button
            type="button"
            onClick={() =>
              getPlatform().shareContent({ title: 'Join my poker game', url: window.location.href })
            }
          >
            Share Story
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
