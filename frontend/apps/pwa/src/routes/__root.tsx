import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Header } from '@stackbluff/shared/components/Header';
import { Toaster } from 'sonner';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useEffect } from 'react';
import { generateAndSubmitFingerprint } from '@/services/fingerprint';
import { EmailVerificationBanner } from '@/components/auth/EmailVerificationBanner';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { isAuthenticated, user, loadUser } = useAuthStore();

  // Submit device fingerprint after authentication
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        generateAndSubmitFingerprint(token).catch((err) => {
          console.warn('Fingerprint submission failed:', err);
        });
      }
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && !user) {
      loadUser();
    }
  }, [isAuthenticated, user, loadUser]);

  return (
    <div className="h-full">
      <Header />  {/* fixed header, out of flow */}
      <main className="mt-16 h-[calc(100vh-64px)] overflow-y-auto">
        <EmailVerificationBanner />
          <Outlet />
      </main>
      <InstallPrompt />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
