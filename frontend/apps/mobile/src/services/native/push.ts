import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { authedFetch, getDeviceIdAsync, getEasProjectId } from './config';
import { notificationDataToRoute } from './deep-links';

/**
 * Push notifications (expo-notifications) — Agent-06 lane.
 *
 * Flow:
 *  1. `configureForegroundPresentation()` once at root layout.
 *  2. After login (A5), `registerForPushNotificationsAsync()`:
 *     permissions → Android channel 'game' (#4edea3 light) → Expo push
 *     token (projectId from app.json `extra.eas.projectId`) →
 *     POST `${apiBaseUrl}/api/push/register`.
 *  3. `addNotificationListeners()` wires foreground delivery, notification
 *     taps (mapped through the navigation-map route table, see
 *     deep-links.ts) and the cold-start tap, and returns a cleanup fn.
 *     `addForegroundNotificationListener` / `addNotificationTapListener`
 *     remain available for callers that want the granular pieces.
 */

const ANDROID_CHANNEL_ID = 'game';
/** Brand accent from the frozen theme contract (ui-native tokens). */
const ANDROID_CHANNEL_LIGHT_COLOR = '#4edea3';

export interface PushRegistrationResult {
  /** The Expo push token (`ExponentPushToken[...]`), null on failure. */
  token: string | null;
  /** True when the backend accepted the device registration. */
  registered: boolean;
  /** Machine-readable reason on failure (for analytics/logs). */
  reason?:
    | 'unsupported-platform'
    | 'emulator'
    | 'permission-denied'
    | 'token-error'
    | 'backend-rejected';
}

/** Show alerts while the app is foregrounded (both platforms). */
export function configureForegroundPresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Idempotent Android notification channel setup ('game', accent light). */
export async function ensureGameChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Game',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: ANDROID_CHANNEL_LIGHT_COLOR,
    sound: 'default',
    showBadge: true,
    enableVibrate: true,
    enableLights: true,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

/**
 * Ask for permissions, fetch the Expo push token and register the device
 * with the backend (`POST /api/push/register`, auth-guarded; user identity
 * comes from the bearer token). Safe to call repeatedly.
 */
export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return { token: null, registered: false, reason: 'unsupported-platform' };
  }
  if (!Device.isDevice) {
    // Emulators cannot receive remote push.
    if (__DEV__) {
      console.log('[push] Skipping registration on emulator/simulator');
    }
    return { token: null, registered: false, reason: 'emulator' };
  }

  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted;
  if (!granted) {
    const request = await Notifications.requestPermissionsAsync();
    granted = request.granted;
  }
  if (!granted) {
    return { token: null, registered: false, reason: 'permission-denied' };
  }

  await ensureGameChannelAsync();

  try {
    const projectId = getEasProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const pushToken = tokenResponse.data;
    const registered = await registerDeviceOnBackend(pushToken);
    return {
      token: pushToken,
      registered,
      reason: registered ? undefined : 'backend-rejected',
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('[push] Failed to fetch push token', error);
    }
    return { token: null, registered: false, reason: 'token-error' };
  }
}

async function registerDeviceOnBackend(pushToken: string): Promise<boolean> {
  try {
    const deviceId = await getDeviceIdAsync();
    const response = await authedFetch('/api/push/register', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceId,
        platform: Platform.OS,
        push_token: pushToken,
      }),
    });
    return response.ok;
  } catch (error) {
    if (__DEV__) {
      console.warn('[push] Device registration failed', error);
    }
    return false;
  }
}

/**
 * Foreground/background delivery listener. Fires for notifications received
 * while the app is open. Returns a cleanup function.
 */
export function addForegroundNotificationListener(
  handler: (notification: Notifications.Notification) => void,
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(handler);
  return () => subscription.remove();
}

/**
 * Tap (response) listener. Maps the notification payload onto an internal
 * route per the navigation map (`stackbluff://table/123` → `/table/123`)
 * and hands it to `handler`. Returns a cleanup function.
 */
export function addNotificationTapListener(
  handler: (route: string | null, notification: Notifications.NotificationResponse) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(notificationResponseToRoute(response), response);
  });
  return () => subscription.remove();
}

/** Map a notification response onto an internal route (or null). */
export function notificationResponseToRoute(
  response: Notifications.NotificationResponse,
): string | null {
  return notificationDataToRoute(response.notification.request.content.data);
}

/* ── Combined listener wiring ────────────────────────────────────────────── */

/** Stable key used to de-duplicate a tap that is delivered twice. */
function tapKey(response: Notifications.NotificationResponse): string {
  const identifier = response.notification.request.identifier ?? '';
  return `${identifier}:${response.actionIdentifier}`;
}

const handledTapKeys = new Set<string>();

export interface NotificationListenersOptions {
  /** Called for notifications delivered while the app is foregrounded. */
  onForeground?: (notification: Notifications.Notification) => void;
  /** Called for every tap with its mapped internal route (may be null). */
  onTap?: (route: string | null, response: Notifications.NotificationResponse) => void;
  /**
   * Navigation sink for mapped tap routes. Defaults to expo-router's
   * imperative `router.push`. Provide your own (e.g. a navigation ref) if
   * the router is not mounted yet.
   */
  navigate?: (route: string) => void;
}

/**
 * All-in-one notification wiring (public surface name):
 *
 *  - foreground presentation handler (idempotent),
 *  - foreground/background delivery listener → `onForeground`,
 *  - tap listener → route mapped per the navigation map
 *    (`stackbluff://table/123` → `/table/123`, `clubs/<id>`,
 *    `tournaments/<id>`, `leaderboard`, `missions`, …) → `onTap` +
 *    `navigate`,
 *  - cold-start tap (app killed → user tapped) via
 *    `getLastNotificationResponseAsync()`, de-duplicated against the warm
 *    listener by response key.
 *
 * Returns a cleanup function that removes every subscription.
 */
export function addNotificationListeners(options: NotificationListenersOptions = {}): () => void {
  configureForegroundPresentation();
  const navigate = options.navigate ?? ((route: string) => router.push(route as never));

  const handleTap = (response: Notifications.NotificationResponse): void => {
    const key = tapKey(response);
    if (handledTapKeys.has(key)) return;
    handledTapKeys.add(key);
    if (handledTapKeys.size > 64) {
      // Bound the dedupe set — old taps are irrelevant by then.
      const first = handledTapKeys.values().next().value;
      if (first !== undefined) handledTapKeys.delete(first);
    }
    const route = notificationResponseToRoute(response);
    options.onTap?.(route, response);
    if (route) navigate(route);
  };

  const received = Notifications.addNotificationReceivedListener((notification) => {
    options.onForeground?.(notification);
  });
  const response = Notifications.addNotificationResponseReceivedListener(handleTap);

  // Cold start: the OS delivers the launch tap here, not through the warm
  // emitter (and on Android the warm listener can additionally fire for it
  // — the dedupe key collapses the double delivery).
  void Notifications.getLastNotificationResponseAsync().then((last) => {
    if (last) handleTap(last);
  });

  return () => {
    received.remove();
    response.remove();
  };
}
