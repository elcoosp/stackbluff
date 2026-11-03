/**
 * Auth guard hook — Task 3-b.
 *
 * The PWA's `lib/authGuard.ts` (`requireAuth` throwing a TanStack redirect
 * from `beforeLoad`) is ported once in `src/lib/authGuard.ts` as the hook
 * `useAuthGuard` (async token check → `/(auth)/login?redirectTo=…`).
 * Re-exported here under the conventional `hooks/` home so screen imports
 * can use either path without duplicating the implementation.
 */
export {
  isAuthenticatedAsync,
  loginRouteWithRedirect,
  useAuthGuard,
} from '../lib/authGuard';
