import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { redirect } from '@tanstack/react-router';

export function requireAuth() {
  const { isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated) {
    const currentPath = window.location.pathname + window.location.search;
    throw redirect({ to: '/login', search: { redirect: currentPath } });
  }
}
