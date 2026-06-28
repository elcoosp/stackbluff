import { clubWebSocket } from './lib/websocket';
import { getPlatform, useUserStore } from '@stackbluff/shared';
import { useEffect } from 'react';

function App() {
  const { user, loading, loadUser } = useUserStore();

  useEffect(() => {
    loadUser();

    // Initialize club WebSocket connection
    clubWebSocket.connect();
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
    </div>
  );
}

export default App;
