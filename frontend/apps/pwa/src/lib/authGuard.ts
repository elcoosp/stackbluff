// frontend/apps/pwa/src/lib/authGuard.ts

import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { redirect } from '@tanstack/react-router';

/**
 * Authentication guard for route protection.
 * Throws a redirect to /login if the user is not authenticated.
 * Intended to be used in route `beforeLoad` hooks.
 */
export function requireAuth(): void {
  const { user } = useAuthStore.getState();
  if (!user) {
    // Redirect to login page; preserves the current location for post-login redirect if needed
    throw redirect({
      to: '/login',
      search: { redirect: window.location.pathname },
    });
  }
}
