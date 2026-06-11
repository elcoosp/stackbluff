import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { getPlatform } from './lib/platform';
import { LobbyPage } from './pages/LobbyPage';

function App() {
  const platform = getPlatform();

  useEffect(() => {
    const cleanup = platform.backButton.onClick(() => {
      if (window.location.pathname !== '/lobby' && window.location.pathname !== '/') {
        window.history.back();
      } else {
        platform.close();
      }
    });
    return cleanup;
  }, [platform]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/table/:id" element={<div>Table View (to be implemented)</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
