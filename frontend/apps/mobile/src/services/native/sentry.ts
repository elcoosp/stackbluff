import * as Sentry from '@sentry/react-native';

/**
 * Sentry bootstrap (Agent-06 lane).
 *
 * No-op unless `EXPO_PUBLIC_SENTRY_DSN` is provided — dev builds and forks
 * stay silent instead of spamming errors about missing DSNs.
 */

export interface SentryInitResult {
  enabled: boolean;
  reason?: 'dsn-missing';
}

export function initSentry(): SentryInitResult {
  return initializeSentry();
}

/**
 * Public-surface name (see services/native/index.ts). Guards on
 * `EXPO_PUBLIC_SENTRY_DSN` — a no-op when absent.
 */
export function initializeSentry(): SentryInitResult {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || dsn.trim().length === 0) {
    if (__DEV__) {
      console.log('[sentry] EXPO_PUBLIC_SENTRY_DSN not set — error reporting disabled');
    }
    return { enabled: false, reason: 'dsn-missing' };
  }

  Sentry.init({
    dsn: dsn.trim(),
    environment:
      process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? (__DEV__ ? 'development' : 'production'),
    debug: __DEV__ && process.env.EXPO_PUBLIC_SENTRY_DEBUG === 'true',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  });
  return { enabled: true };
}

/** Safe capture helper that never throws from user code paths. */
export function captureExceptionSafe(error: unknown, context?: Record<string, unknown>): void {
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Swallow — error reporting must never take the app down.
  }
}

/** Re-export for callers that want breadcrumbs / user context helpers. */
export { Sentry };
