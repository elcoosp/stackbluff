import { getToken } from '@stackbluff/shared/src/auth/token';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * Auth guard — native port of apps/pwa/src/lib/authGuard.ts (Task 3-b).
 *
 * PWA's `requireAuth` throws a TanStack redirect from `beforeLoad` when the
 * zustand auth store has no user. On native the token lives behind an async
 * storage API, so the guard is a hook: `useAuthGuard` awaits the token and,
 * when absent, replaces to `/(auth)/login?redirectTo=<current-path>` (the
 * login screen honors `redirectTo` after a successful sign-in).
 *
 * Usage in protected screens:
 * ```tsx
 * const guarded = useAuthGuard();
 * if (!guarded) return <LoadingRows />; // don't render data pre-check
 * ```
 */

/** Async predicate — true when a token exists in the platform surface. */
export async function isAuthenticatedAsync(): Promise<boolean> {
  try {
    const token = await getToken();
    return !!token;
  } catch {
    return false;
  }
}

/** Builds the login route with a preserved redirect destination. */
export function loginRouteWithRedirect(redirectTo: string | null | undefined): string {
  if (redirectTo?.startsWith('/')) {
    return `/(auth)/login?redirectTo=${encodeURIComponent(redirectTo)}`;
  }
  return '/(auth)/login';
}

/**
 * Redirects to login (preserving the current path) when no token is stored.
 * Returns `true` once the check passed — render nothing/loading until then.
 */
export function useAuthGuard(enabled = true): boolean {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setChecked(true);
      return;
    }
    let mounted = true;
    void (async () => {
      const authed = await isAuthenticatedAsync();
      if (!mounted) return;
      if (!authed) {
        router.replace(loginRouteWithRedirect(pathname) as never);
      } else {
        setChecked(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, pathname, enabled]);

  return checked;
}
