/**
 * Native services barrel (Agent-06 lane).
 *
 * Public surface:
 * ```ts
 * import {
 *   initializeSentry,          // boot (root layout, before React renders)
 *   ensureNativePlatformConfigured, // boot (configurePlatform + ws bridge)
 *   registerForPushNotificationsAsync, // after login
 *   addNotificationListeners,  // root layout effect
 *   useDeepLinkHandler,        // root layout hook
 *   initializePurchases,       // boot
 *   purchaseProduct, restorePurchases, // shop sheet
 *   useEntitlements,           // screens read chips / pass / pro flags
 * } from '@/services/native';
 * ```
 */

export type {
  CustomerInfoLike,
  EntitlementsState,
  ProductId,
} from '../../lib/entitlements';
export {
  CLUB_PRO_ENTITLEMENT,
  chipsForProduct,
  PRODUCT_CHIP_GRANTS,
  SEASON_PASS_ENTITLEMENT,
  useEntitlements,
  useEntitlementsStore,
} from '../../lib/entitlements';
export * from './config';
export * from './deep-links';
export * from './platform';
export * from './purchases';
export * from './push';
export * from './sentry';
