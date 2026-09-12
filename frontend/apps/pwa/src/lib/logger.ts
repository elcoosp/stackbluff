/**
 * Structured logging utility with transport support.
 * In production, logs are shipped to Sentry (if configured).
 * In development, logs go to console.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: string | number | boolean | undefined;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context: LogContext;
  timestamp: string;
  extra?: Record<string, unknown>;
}

type LogTransport = (entry: LogEntry) => void;

declare global {
  interface Window {
    __SENTRY__?: {
      captureException: (...args: unknown[]) => void;
      captureMessage: (...args: unknown[]) => void;
    };
  }
}

/**
 * Normalize arbitrary `extra` values into a loggable record.
 * Objects pass through; primitives and Errors are wrapped so log entries
 * always carry a JSON-serializable record.
 */
function normalizeExtra(extra: unknown): Record<string, unknown> | undefined {
  if (extra === undefined || extra === null) return undefined;
  if (typeof extra === 'object') return extra as Record<string, unknown>;
  return { value: extra };
}

/**
 * Sentry transport: ships errors and warnings to Sentry.
 * Only active if @sentry/browser is available.
 */
function createSentryTransport(): LogTransport | null {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') {
    return null;
  }

  // Lazy-load Sentry to avoid bundling it in development
  try {
    // Dynamic import would be ideal, but for sync logging we check if it's available
    const Sentry = window.__SENTRY__;
    if (!Sentry) return null;

    return (entry: LogEntry) => {
      try {
        if (entry.level === 'error') {
          Sentry.captureException(
            entry.extra?.error instanceof Error ? entry.extra.error : new Error(entry.message),
            {
              contexts: {
                log: {
                  message: entry.message,
                  context: entry.context,
                  extra: entry.extra,
                },
              },
            },
          );
        } else if (entry.level === 'warn') {
          Sentry.captureMessage(entry.message, {
            level: 'warning',
            contexts: {
              log: {
                context: entry.context,
                extra: entry.extra,
              },
            },
          });
        }
      } catch (_e) {
        // Silently fail - don't let logging break the app
      }
    };
  } catch {
    return null;
  }
}

class Logger {
  private context: LogContext;
  private transports: LogTransport[];

  constructor(context: LogContext = {}, transports: LogTransport[] = []) {
    this.context = context;
    this.transports = transports;
  }

  private formatMessage(level: LogLevel, message: string, extra?: Record<string, unknown>): string {
    const contextStr =
      Object.keys(this.context).length > 0 ? ` [${JSON.stringify(this.context)}]` : '';
    const extraStr = extra ? ` ${this.safeStringify(extra)}` : '';
    return `${new Date().toISOString()} [${level.toUpperCase()}]${contextStr} ${message}${extraStr}`;
  }

  /**
   * Safe stringify that handles Error objects properly.
   */
  private safeStringify(obj: Record<string, unknown>): string {
    if (obj instanceof Error) {
      return JSON.stringify({
        name: obj.name,
        message: obj.message,
        stack: obj.stack,
      });
    }
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  }

  private log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      context: this.context,
      timestamp: new Date().toISOString(),
      extra,
    };

    // Console output (dev only for debug, always for others)
    if (level === 'debug' && process.env.NODE_ENV !== 'development') {
      // Skip debug in production
    } else {
      const formatted = this.formatMessage(level, message, extra);
      switch (level) {
        case 'debug':
          console.debug(formatted);
          break;
        case 'info':
          console.info(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
          console.error(formatted);
          break;
      }
    }

    // Send to transports (Sentry, etc.)
    for (const transport of this.transports) {
      try {
        transport(entry);
      } catch {
        // Don't let transport failures break logging
      }
    }
  }

  debug(message: string, extra?: unknown): void {
    this.log('debug', message, normalizeExtra(extra));
  }

  info(message: string, extra?: unknown): void {
    this.log('info', message, normalizeExtra(extra));
  }

  warn(message: string, extra?: unknown): void {
    this.log('warn', message, normalizeExtra(extra));
  }

  error(message: string, error?: unknown, extra?: unknown): void {
    const errorInfo =
      error instanceof Error
        ? { message: error.message, stack: error.stack, name: error.name }
        : error;
    this.log('error', message, { ...normalizeExtra(extra), error: errorInfo });
  }

  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext }, this.transports);
  }
}

// Initialize transports (Sentry in production)
const sentryTransport = createSentryTransport();
const transports: LogTransport[] = sentryTransport ? [sentryTransport] : [];

// Create logger instances for different modules
export const consentLogger = new Logger({ component: 'consent' }, transports);
export const notificationLogger = new Logger({ component: 'notifications' }, transports);
export const analyticsLogger = new Logger({ component: 'analytics' }, transports);

// Default logger
export const logger = new Logger({}, transports);
