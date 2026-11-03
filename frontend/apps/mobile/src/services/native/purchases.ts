import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesOfferings,
} from 'react-native-purchases';
import { PRODUCT_CHIP_GRANTS, useEntitlementsStore } from '../../lib/entitlements';
import { authedFetch, isPlaceholderValue } from './config';

/**
 * RevenueCat purchases (react-native-purchases@9) — Agent-06 lane.
 *
 * Flow:
 *  1. `configurePurchases()` once at startup (root layout / providers).
 *     Keys come from `EXPO_PUBLIC_REVENUECAT_IOS_KEY` /
 *     `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, falling back to
 *     `app.json` → `expo.extra.revenuecat.{ios,android}`.
 *  2. `purchaseProduct(id)` for chips_10k | chips_50k | chips_200k |
 *     season_pass | club_pro. On success the receipt/transaction is posted
 *     to `/api/payments/revenuecat/verify` where the server credits chips
 *     (server-side verification via the RevenueCat REST API).
 *  3. `startCustomerInfoListener()` keeps the entitlements zustand store
 *     (src/lib/entitlements.ts) in sync with RevenueCat.
 */

/** Locked IAP product ids (MASTER_PLAN D8). */
export const IAP_PRODUCT_IDS = [
  'chips_10k',
  'chips_50k',
  'chips_200k',
  'season_pass',
  'club_pro',
] as const;

export type IapProductId = (typeof IAP_PRODUCT_IDS)[number];

export interface PurchaseVerifyResponse {
  status?: string;
  product_id?: string;
  chips_awarded?: number;
  already_processed?: boolean;
  error?: string;
}

export type PurchaseOutcome =
  | {
      status: 'completed';
      productId: string;
      customerInfo: CustomerInfo;
      verify?: PurchaseVerifyResponse;
    }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

export interface PurchasesConfigResult {
  configured: boolean;
  placeholderKeys: boolean;
  platform: string;
}

const PLACEHOLDER_KEY_HINT =
  '[purchases] RevenueCat API key is a placeholder — set EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY (or expo.extra.revenuecat) before shipping.';

let configurePromise: Promise<PurchasesConfigResult> | null = null;

function readApiKey(): { key: string; envName: string } {
  const extra = Constants.expoConfig?.extra as
    | { revenuecat?: { ios?: string; android?: string } }
    | undefined;
  const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? extra?.revenuecat?.ios;
  const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? extra?.revenuecat?.android;
  if (Platform.OS === 'android') {
    return { key: androidKey ?? '', envName: 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY' };
  }
  return { key: iosKey ?? '', envName: 'EXPO_PUBLIC_REVENUECAT_IOS_KEY' };
}

/**
 * Configure RevenueCat exactly once. Subsequent calls return the first
 * result. `appUserId` (optional) ties the RevenueCat user to our user id;
 * when omitted RevenueCat generates an anonymous id and later `logIn`
 * calls can alias it.
 *
 * `initializePurchases` is the same function under its public-surface name
 * (see services/native/index.ts).
 */
export function initializePurchases(options?: {
  appUserId?: string | null;
}): Promise<PurchasesConfigResult> {
  return configurePurchases(options);
}

export function configurePurchases(options?: {
  appUserId?: string | null;
}): Promise<PurchasesConfigResult> {
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    const platform = Platform.OS;
    if (platform !== 'android' && platform !== 'ios') {
      return { configured: false, placeholderKeys: false, platform };
    }
    const { key, envName } = readApiKey();
    const placeholderKeys = isPlaceholderValue(key);
    if (placeholderKeys) {
      // Clear dev banner (mission requirement) — also fires once in prod to
      // make a misconfigured build visible in logs.
      console.warn(PLACEHOLDER_KEY_HINT, `(missing ${envName})`);
      return { configured: false, placeholderKeys: true, platform };
    }
    try {
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }
      Purchases.configure({
        apiKey: key,
        ...(options?.appUserId ? { appUserID: options.appUserId } : {}),
      });
      return { configured: true, placeholderKeys: false, platform };
    } catch (error) {
      console.warn('[purchases] configure() failed', error);
      return { configured: false, placeholderKeys, platform };
    }
  })();

  return configurePromise;
}

/** Fetch current RevenueCat offerings (for the shop sheet). */
export async function fetchOfferings(): Promise<PurchasesOfferings | null> {
  const config = await configurePurchases();
  if (!config.configured) return null;
  try {
    return await Purchases.getOfferings();
  } catch (error) {
    console.warn('[purchases] getOfferings failed', error);
    return null;
  }
}

/**
 * Purchase a locked product id and verify it against the backend.
 * The backend maps `product_id` → chip grant / entitlement and is
 * idempotent per `transaction_id`, so retries are safe.
 */
export async function purchaseProduct(productId: string): Promise<PurchaseOutcome> {
  if (!(IAP_PRODUCT_IDS as readonly string[]).includes(productId)) {
    return { status: 'failed', message: `Unknown product: ${productId}` };
  }
  const config = await configurePurchases();
  if (!config.configured) {
    return { status: 'failed', message: 'Purchases are not configured (missing API key).' };
  }

  try {
    const result = await Purchases.purchaseProduct(productId);
    syncEntitlementsFromCustomerInfo(result.customerInfo);

    const transactionId = result.transaction?.transactionIdentifier ?? '';
    const appUserId = await Purchases.getAppUserID().catch(() => '');
    const verify = await verifyPurchaseOnBackend({
      receipt: transactionId || productId,
      productId,
      transactionId,
      appUserId,
    });

    if (verify?.chips_awarded != null && verify.chips_awarded > 0) {
      useEntitlementsStore.getState().creditChips(verify.chips_awarded);
      useEntitlementsStore.getState().setEntitlements({ lastVerifiedAt: Date.now() });
    }
    return { status: 'completed', productId, customerInfo: result.customerInfo, verify };
  } catch (error) {
    if (isPurchaseCancelled(error)) {
      return { status: 'cancelled' };
    }
    const message = error instanceof Error ? error.message : 'Purchase failed';
    console.warn('[purchases] purchase failed', error);
    return { status: 'failed', message };
  }
}

function isPurchaseCancelled(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

async function verifyPurchaseOnBackend(payload: {
  receipt: string;
  productId: string;
  transactionId: string;
  appUserId: string;
}): Promise<PurchaseVerifyResponse | undefined> {
  try {
    const response = await authedFetch('/api/payments/revenuecat/verify', {
      method: 'POST',
      body: JSON.stringify({
        receipt: payload.receipt,
        product_id: payload.productId,
        transaction_id: payload.transactionId || undefined,
        app_user_id: payload.appUserId || undefined,
        platform: Platform.OS,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn('[purchases] verify failed', response.status, body);
      return undefined;
    }
    return (await response.json()) as PurchaseVerifyResponse;
  } catch (error) {
    console.warn('[purchases] verify request failed', error);
    return undefined;
  }
}

/**
 * Restore previous purchases (subscription entitlements). Consumable chip
 * packs are not restorable by the stores; the backend re-derives
 * entitlements from RevenueCat.
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  const config = await configurePurchases();
  if (!config.configured) return null;
  try {
    const info = await Purchases.restorePurchases();
    syncEntitlementsFromCustomerInfo(info);
    return info;
  } catch (error) {
    console.warn('[purchases] restore failed', error);
    return null;
  }
}

/**
 * Map a RevenueCat `CustomerInfo` onto the local entitlements store:
 * `season_pass` / `club_pro` entitlement identifiers drive the flags
 * (absolute set — the flags always reflect the current RC state).
 */
export function syncEntitlementsFromCustomerInfo(info: CustomerInfo): void {
  useEntitlementsStore.getState().setFromCustomerInfo(info);
}

/**
 * Keep the entitlements store in sync with RevenueCat customer info
 * updates (renewals, expirations, restores). Returns a cleanup function.
 */
export function startCustomerInfoListener(): () => void {
  const listener = (info: CustomerInfo): void => {
    syncEntitlementsFromCustomerInfo(info);
  };
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/** Chip grant advertised for a product id (0 for pass/pro). */
export function chipsForProductId(productId: string): number {
  return PRODUCT_CHIP_GRANTS[productId] ?? 0;
}

/** Convenience alias used by A5's shop sheet to render package lists. */
export async function getCurrentCustomerInfo(): Promise<CustomerInfo | null> {
  const config = await configurePurchases();
  if (!config.configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}
