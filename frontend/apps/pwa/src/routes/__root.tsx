import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Header } from '@stackbluff/shared/components/Header';
import { Toaster } from 'sonner';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useEffect } from 'react';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { isAuthenticated, user, loadUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && !user) {
      loadUser();
    }
  }, [isAuthenticated, user, loadUser]);

  return (
    <div className="h-full">
      <Header />  {/* fixed header, out of flow */}
      <main className="mt-16 h-[calc(100vh-64px)] overflow-y-auto">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
