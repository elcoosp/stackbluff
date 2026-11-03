/**
 * Navigation map integrity — pins the FROZEN contract
 * docs/mobile-plan/contracts/navigation-map.md (PWA TanStack routes -> expo-router).
 *
 * The table below is HARDCODED from the contract on purpose: it must fail loudly
 * if the mapping drifts, and it stays valid even before/after
 * `@stackbluff/ui-native` starts exporting it. Deep-link rule from the contract:
 * `stackbluff://<path>` mirrors the PWA path segments exactly — the only allowed
 * differences are expo-router group wrappers `(tabs)` / `(auth)` and the
 * `/settings` -> `/settings/index` spelling. The `derives-from-contract-rules`
 * test re-derives every mobile path from the PWA path so a typo in the hardcoded
 * table can never slip through.
 *
 * Count note: the plan/specs shorthand says "29 routes". The frozen contract
 * table expands to 37 concrete paths (the settings row expands to 7 sub-pages,
 * the auth row to 5, legal to 2, plus `/responsible-gaming`). This test pins the
 * FULL expanded table — 37 — and fails if anything is added/removed/renamed
 * without a contract change.
 */

type RouteKind = 'redirect' | 'tabs' | 'stack' | 'settings' | 'auth' | 'legal';

interface RouteMapping {
  /** PWA TanStack route. */
  pwa: string;
  /** Mobile expo-router path exactly as written in the contract. */
  mobile: string;
  kind: RouteKind;
}

const NAVIGATION_MAP: RouteMapping[] = [
  { pwa: '/', mobile: '(tabs)/lobby', kind: 'redirect' },
  { pwa: '/lobby', mobile: '(tabs)/lobby', kind: 'tabs' },
  { pwa: '/tournaments', mobile: '(tabs)/tournaments', kind: 'tabs' },
  { pwa: '/tournaments/$tournamentId', mobile: '/tournaments/$tournamentId', kind: 'stack' },
  { pwa: '/tournaments-history', mobile: '/tournaments-history', kind: 'stack' },
  { pwa: '/clubs', mobile: '(tabs)/clubs', kind: 'tabs' },
  { pwa: '/clubs/$clubId', mobile: '/clubs/$clubId', kind: 'stack' },
  { pwa: '/clubs/join', mobile: '/clubs/join', kind: 'stack' },
  { pwa: '/table/$tableId', mobile: '/table/$tableId', kind: 'stack' },
  { pwa: '/shop', mobile: '(tabs)/shop', kind: 'tabs' },
  { pwa: '/leaderboard', mobile: '/leaderboard', kind: 'stack' },
  { pwa: '/missions', mobile: '/missions', kind: 'stack' },
  { pwa: '/puzzle', mobile: '/puzzle', kind: 'stack' },
  { pwa: '/replays', mobile: '/replays', kind: 'stack' },
  { pwa: '/history', mobile: '/history', kind: 'stack' },
  { pwa: '/hands/$handId', mobile: '/hands/$handId', kind: 'stack' },
  { pwa: '/players/$userId', mobile: '/players/$userId', kind: 'stack' },
  { pwa: '/profile', mobile: '(tabs)/profile', kind: 'tabs' },
  { pwa: '/settings', mobile: '/settings/index', kind: 'settings' },
  { pwa: '/settings/account', mobile: '/settings/account', kind: 'settings' },
  { pwa: '/settings/appearance', mobile: '/settings/appearance', kind: 'settings' },
  { pwa: '/settings/audio', mobile: '/settings/audio', kind: 'settings' },
  { pwa: '/settings/notifications', mobile: '/settings/notifications', kind: 'settings' },
  { pwa: '/settings/payments', mobile: '/settings/payments', kind: 'settings' },
  { pwa: '/settings/privacy', mobile: '/settings/privacy', kind: 'settings' },
  { pwa: '/settings/telegram', mobile: '/settings/telegram', kind: 'settings' },
  { pwa: '/login', mobile: '(auth)/login', kind: 'auth' },
  { pwa: '/register', mobile: '(auth)/register', kind: 'auth' },
  { pwa: '/forgot-password', mobile: '(auth)/forgot-password', kind: 'auth' },
  { pwa: '/reset-password', mobile: '(auth)/reset-password', kind: 'auth' },
  { pwa: '/verify-email', mobile: '(auth)/verify-email', kind: 'auth' },
  { pwa: '/guide', mobile: '/guide', kind: 'stack' },
  { pwa: '/help', mobile: '/help', kind: 'stack' },
  { pwa: '/referrals', mobile: '/referrals', kind: 'stack' },
  { pwa: '/responsible-gaming', mobile: '/responsible-gaming', kind: 'stack' },
  { pwa: '/legal/privacy', mobile: '/legal/privacy', kind: 'legal' },
  { pwa: '/legal/terms', mobile: '/legal/terms', kind: 'legal' },
];

const TAB_ROUTES = ['lobby', 'tournaments', 'clubs', 'shop', 'profile'];
const AUTH_ROUTES = ['login', 'register', 'forgot-password', 'reset-password', 'verify-email'];

/**
 * Re-derives the expected mobile path from the PWA path + contract rules:
 * mirror path segments exactly; only group wrappers `(tabs)` / `(auth)`, the
 * index redirect, and `/settings` -> `/settings/index` may differ.
 */
function expectedMobilePath(mapping: RouteMapping): string {
  const body = mapping.pwa.replace(/^\//, '');
  switch (mapping.kind) {
    case 'redirect':
      return '(tabs)/lobby';
    case 'tabs':
      return `(tabs)/${body}`;
    case 'auth':
      return `(auth)/${body}`;
    case 'settings':
      return body === 'settings' ? '/settings/index' : `/${body}`;
    default:
      return `/${body}`;
  }
}

describe('navigation map integrity (frozen contract)', () => {
  it('pins the full expanded contract table (37 concrete routes)', () => {
    expect(NAVIGATION_MAP).toHaveLength(37);
  });

  it('derives every mobile path from the contract rules (no typos)', () => {
    for (const mapping of NAVIGATION_MAP) {
      expect(`${mapping.pwa} -> ${mapping.mobile}`).toBe(
        `${mapping.pwa} -> ${expectedMobilePath(mapping)}`,
      );
      expect(mapping.mobile).toBe(expectedMobilePath(mapping));
    }
  });

  it('mirrors deep-link path segments (stackbluff://table/123 etc.)', () => {
    // The redirect row ('/' -> '(tabs)/lobby') has no PWA segments to mirror.
    const mirrored = NAVIGATION_MAP.filter((mapping) => mapping.kind !== 'redirect');
    for (const mapping of mirrored) {
      const pwaSegments = mapping.pwa.replace(/^\//, '').split('/');
      const mobileSegments = mapping.mobile.replace(/^\//, '').split('/');
      const stripped = mobileSegments.filter((segment) => !/^\((tabs|auth)\)$/.test(segment));
      const normalized = stripped.join('/') === 'settings/index' ? ['settings'] : stripped;
      expect(normalized).toEqual(pwaSegments);
    }
  });

  it('has unique PWA routes and unique mobile paths (redirect alias excluded)', () => {
    const pwaRoutes = NAVIGATION_MAP.map((mapping) => mapping.pwa);
    expect(new Set(pwaRoutes).size).toBe(pwaRoutes.length);
    // The '/' -> '(tabs)/lobby' redirect row intentionally aliases the lobby tab
    // path, so uniqueness is asserted on concrete (non-redirect) mappings only.
    const concrete = NAVIGATION_MAP.filter((mapping) => mapping.kind !== 'redirect').map(
      (mapping) => mapping.mobile,
    );
    expect(new Set(concrete).size).toBe(concrete.length);
  });

  it('exposes exactly the 5 contract tabs: Lobby, Tournaments, Clubs, Shop, Profile', () => {
    const tabRoutes = NAVIGATION_MAP.filter((mapping) => mapping.kind === 'tabs').map((mapping) =>
      mapping.pwa.replace(/^\//, ''),
    );
    expect([...tabRoutes].sort()).toEqual([...TAB_ROUTES].sort());
    for (const tab of TAB_ROUTES) {
      expect(NAVIGATION_MAP.some((mapping) => mapping.mobile === `(tabs)/${tab}`)).toBe(true);
    }
  });

  it('routes the 5 auth screens through the (auth) group with no tabs', () => {
    const auth = NAVIGATION_MAP.filter((mapping) => mapping.kind === 'auth');
    expect(auth).toHaveLength(AUTH_ROUTES.length);
    for (const mapping of auth) {
      expect(mapping.mobile.startsWith('(auth)/')).toBe(true);
    }
    expect(auth.map((mapping) => mapping.pwa.replace(/^\//, '')).sort()).toEqual(
      [...AUTH_ROUTES].sort(),
    );
  });

  it('keeps the 7 settings sub-pages as a settings stack', () => {
    const settings = NAVIGATION_MAP.filter((mapping) => mapping.kind === 'settings');
    expect(settings).toHaveLength(8); // index + 7 sub-pages
    for (const mapping of settings) {
      expect(mapping.mobile.startsWith('/settings')).toBe(true);
    }
  });

  it('maps / to the lobby tab via the app/index.tsx redirect', () => {
    const index = NAVIGATION_MAP.find((mapping) => mapping.kind === 'redirect');
    expect(index?.pwa).toBe('/');
    expect(index?.mobile).toBe('(tabs)/lobby');
  });

  it('keeps the table route a fullscreen stack outside the tabs', () => {
    const table = NAVIGATION_MAP.find((mapping) => mapping.pwa === '/table/$tableId');
    expect(table?.mobile).toBe('/table/$tableId');
    expect(table?.kind).toBe('stack');
    expect(table?.mobile.startsWith('(tabs)')).toBe(false);
  });

  it('includes both legal pages', () => {
    const legal = NAVIGATION_MAP.filter((mapping) => mapping.kind === 'legal');
    expect(legal.map((mapping) => mapping.pwa).sort()).toEqual(['/legal/privacy', '/legal/terms']);
  });
});
