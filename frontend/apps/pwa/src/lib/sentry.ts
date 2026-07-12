import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { tanstackRouterBrowserTracingIntegration } from '@sentry/react';

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
    integrations: [
      new BrowserTracing(),
      tanstackRouterBrowserTracingIntegration(),
    ],
    tracesSampleRate: 0.1,
    attachStacktrace: true,
    beforeSend(event) {
      // Optional: respect consent store
      // if (!canFireAnalytics()) return null;
      return event;
    },
  });

  console.log('Sentry initialized');
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
