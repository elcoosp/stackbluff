import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('Sentry DSN not configured. Skipping Sentry initialization.');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development',
    release: import.meta.env.VITE_SENTRY_RELEASE || 'local',
    // BrowserTracing is now included in @sentry/react v10
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Capture 10% of transactions in development
    tracesSampleRate: 0.1,
    // Capture 10% of sessions for replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    attachStacktrace: true,
  });

  console.log('✅ Sentry initialized');
}

export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

export function setUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

export function addBreadcrumb(message: string, category?: string, level?: Sentry.SeverityLevel) {
  Sentry.addBreadcrumb({
    message,
    category,
    level: level || 'info',
  });
}

// Export ErrorBoundary for convenience
export const ErrorBoundary = Sentry.ErrorBoundary;
