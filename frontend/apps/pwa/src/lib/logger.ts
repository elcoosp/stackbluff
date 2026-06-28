/**
 * Structured logging utility for the frontend.
 * Provides consistent logging with context and levels.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: any;
}

class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private formatMessage(level: LogLevel, message: string, extra?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(this.context).length > 0
      ? ` [${JSON.stringify(this.context)}]`
      : '';
    const extraStr = extra ? ` ${JSON.stringify(extra)}` : '';
    return `${timestamp} [${level.toUpperCase()}]${contextStr} ${message}${extraStr}`;
  }

  debug(message: string, extra?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, extra));
    }
  }

  info(message: string, extra?: any): void {
    console.info(this.formatMessage('info', message, extra));
  }

  warn(message: string, extra?: any): void {
    console.warn(this.formatMessage('warn', message, extra));
  }

  error(message: string, error?: Error | any, extra?: any): void {
    const errorInfo = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    console.error(this.formatMessage('error', message, { ...extra, error: errorInfo }));
  }

  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }
}

// Create logger instances for different modules
export const consentLogger = new Logger({ component: 'consent' });
export const notificationLogger = new Logger({ component: 'notifications' });
export const analyticsLogger = new Logger({ component: 'analytics' });

// Default logger
export const logger = new Logger();
