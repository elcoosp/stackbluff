import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

/**
 * Deep link handling for the `stackbluff://` scheme (Agent-06 lane).
 *
 * Route mapping mirrors docs/mobile-plan/contracts/navigation-map.md:
 * path segments are mirrored 1:1 onto expo-router paths
 * (`stackbluff://table/123` → `/table/123`, `stackbluff://clubs/abc` →
 * `/clubs/abc`, `stackbluff://tournaments/xyz` → `/tournaments/xyz`).
 *
 * Unknown segments are rejected (returns `null`) instead of navigated to.
 */

/** Route prefixes that exist in the navigation map (static, no params). */
const STATIC_SEGMENTS = new Set([
  'lobby',
  'tournaments',
  'tournaments-history',
  'clubs',
  'leaderboard',
  'missions',
  'puzzle',
  'replays',
  'history',
  'profile',
  'shop',
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
  'guide',
  'help',
  'referrals',
  'responsible-gaming',
]);

/** Prefixes that take exactly one dynamic id segment. */
const DYNAMIC_ID_SEGMENTS = new Set(['table', 'tournaments', 'hands', 'players']);

/** Sub-pages nested one level below a static prefix. */
const NESTED_SEGMENTS: Record<string, Set<string>> = {
  clubs: new Set(['join']),
  settings: new Set([
    'account',
    'appearance',
    'audio',
    'notifications',
    'payments',
    'privacy',
    'telegram',
  ]),
  legal: new Set(['privacy', 'terms']),
};

/** Sanity check for dynamic ids — reject anything that looks like a path. */
function isSafeIdSegment(segment: string): boolean {
  return segment.length > 0 && segment.length <= 128 && /^[A-Za-z0-9._~-]+$/.test(segment);
}

function segmentIsKnown(segments: readonly string[]): boolean {
  if (segments.length === 0) return false;
  const [head, second] = segments;
  if (DYNAMIC_ID_SEGMENTS.has(head)) {
    return segments.length === 2 && isSafeIdSegment(second ?? '');
  }
  if (head === 'clubs') {
    // /clubs, /clubs/join, /clubs/$clubId
    return segments.length === 1 || (segments.length === 2 && isSafeIdSegment(second ?? ''));
  }
  const nested = NESTED_SEGMENTS[head];
  if (nested) {
    return segments.length === 1 || (segments.length === 2 && nested.has(second));
  }
  return segments.length === 1 && STATIC_SEGMENTS.has(head);
}

/**
 * Extract path segments from a deep link URL.
 *
 * Handles the two forms expo apps see in practice:
 *  - `stackbluff://table/123` → ['table', '123'] (first segment lands in the URL "host")
 *  - `https://stackbluff.com/table/123` → ['table', '123'] (host is a real domain)
 */
export function extractDeepLinkSegments(url: string): string[] {
  const withoutFragmentOrQuery = url.split(/[?#]/, 1)[0] ?? '';
  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(withoutFragmentOrQuery);
  if (!schemeMatch) {
    return withoutFragmentOrQuery.split('/').filter((s) => s.length > 0);
  }
  let rest = withoutFragmentOrQuery.slice(schemeMatch[0].length);
  // Collapse leading slashes for triple-slash forms (stackbluff:///table/123).
  rest = rest.replace(/^\/+/, '');
  const parts = rest.split('/').filter((s) => s.length > 0);
  // The first part is the URL "host". For https links that is the domain
  // (contains a dot) — drop it. For custom schemes it is usually the first
  // route segment, unless someone linked stackbluff://stackbluff.com/... .
  if (parts.length > 0 && parts[0].includes('.')) {
    parts.shift();
  }
  return parts;
}

/**
 * Parse a deep link URL into an internal expo-router path per the
 * navigation map. Returns `null` for URLs that do not map to a known route.
 */
export function deepLinkToRoute(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const segments = extractDeepLinkSegments(url.trim());
  if (segments.length === 0 || segments.length > 3) return null;
  if (!segmentIsKnown(segments)) return null;

  let route = `/${segments.join('/')}`;

  // Preserve query params (e.g. redirectTo) when present.
  const queryIndex = url.indexOf('?');
  if (queryIndex >= 0 && queryIndex < url.length - 1) {
    route += url.slice(queryIndex);
  }
  return route;
}

/**
 * Map a push-notification payload onto a route. The backend fanout helper
 * sends `data: { url: 'stackbluff://table/123', ... }`; alternate keys are
 * accepted for forward compatibility.
 */
export function notificationDataToRoute(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  for (const key of ['url', 'deep_link', 'link', 'route']) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      const route = deepLinkToRoute(value);
      if (route) return route;
    }
  }
  return null;
}

/**
 * Subscribe to deep links and navigate with expo-router.
 *
 * Handles both the cold-start URL (`getInitialURL`) and warm links
 * (`stackbluff://…` events). Returns nothing — cleanup happens on unmount.
 *
 * Usage (root layout, A5): call once inside `RootLayout`.
 */
export function useDeepLinkHandler(options?: { enabled?: boolean }): void {
  const router = useRouter();
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;

    void Linking.getInitialURL().then((url) => {
      if (disposed || !url) return;
      const route = deepLinkToRoute(url);
      if (route) {
        // Deep links are dynamic — expo-router's typed Href is too narrow here.
        router.replace(route as never);
      }
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const route = deepLinkToRoute(url);
      if (route) {
        router.push(route as never);
      }
    });

    return () => {
      disposed = true;
      subscription.remove();
    };
  }, [router, enabled]);
}
