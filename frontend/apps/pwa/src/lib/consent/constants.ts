/**
 * Constants for consent management.
 * Centralizes all magic strings and configuration values.
 */

// LocalStorage keys
export const CONSENT_STORAGE_KEY = 'stackbluff-consent';
export const FIRST_HAND_PLAYED_KEY = 'has_played_first_hand';

// Cooldown durations (in milliseconds)
export const MAYBE_LATER_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// API endpoints
export const NOTIFICATIONS_SUBSCRIBE_ENDPOINT = '/notifications/subscribe';
export const NOTIFICATIONS_UNSUBSCRIBE_ENDPOINT = '/notifications/unsubscribe';

// VAPID configuration
export const VAPID_PUBLIC_KEY_ENV = 'VITE_VAPID_PUBLIC_KEY';

// Event names
export const HAND_COMPLETED_EVENT = 'handCompleted';
export const WS_MESSAGE_EVENT = 'ws:message';

// Analytics event names
export const ANALYTICS_COOKIE_CONSENT_ACCEPTED = 'cookie_consent_accepted';
export const ANALYTICS_COOKIE_CONSENT_DECLINED = 'cookie_consent_declined';
export const ANALYTICS_NOTIFICATION_ALLOWED = 'notification_allowed';
export const ANALYTICS_NOTIFICATION_DENIED = 'notification_denied';
export const ANALYTICS_NOTIFICATION_SUBSCRIBED = 'notification_subscribed';
export const ANALYTICS_NOTIFICATION_UNSUBSCRIBED = 'notification_unsubscribed';
