import { Header } from '@stackbluff/shared/components/Header';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { authApi } from '@stackbluff/shared/auth/api';
import { setToken } from '@stackbluff/shared/auth/token';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';

/**
 * M-2 FIX: the mini-app loads `telegram-web-app.js` in index.html but
 * never actually uses the signed `initData` to authenticate. Users were
 * forced to remember a poker-site username/password inside Telegram.
 * This helper exchanges `Telegram.WebApp.initData` for a JWT on app boot
 * and stores the result in the shared auth store.
 */
function useTelegramAutoLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const tg = (window as unknown as {
      Telegram?: {
        WebApp?: {
          initData?: string;
          ready?: () => void;
          expand?: () => void;
        };
      };
    }).Telegram?.WebApp;

    if (!tg?.initData) return;

    // Ready/expand are safe side-effects Telegram expects.
    tg.ready?.();
    tg.expand?.();

    // Already logged in? Skip.
    if (useAuthStore.getState().user) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await authApi.telegramAuth(tg.initData!);
        if (cancelled) return;
        setToken(data.token);
        setAuth(data.user, data.token);
      } catch (e) {
        console.warn('M-2: Telegram auto-login failed, falling back to /login', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setAuth]);
}

function RootComponent() {
  // M-2 FIX: kick off Telegram initData login on app boot.
  useTelegramAutoLogin();
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
