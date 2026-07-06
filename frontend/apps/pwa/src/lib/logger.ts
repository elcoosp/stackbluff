/**
 * Structured logging utility for frontend
 * Provides consistent error reporting with context
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private context: LogContext = {};

  withContext(context: LogContext): Logger {
    const newLogger = new Logger();
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }

  private log(level: LogLevel, message: string, error?: Error, additionalContext?: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...additionalContext },
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    // In production, this would send to error tracking service (Sentry, LogRocket, etc.)
    // For now, we log to console with structured format
    const logFn = console[level] || console.log;
    logFn(JSON.stringify(logEntry, null, 2));

    // TODO: Integrate with actual error tracking service
    // if (level === 'error' && window.Sentry) {
    //   window.Sentry.captureException(error, { extra: logEntry });
    // }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, undefined, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, undefined, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, undefined, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, error, context);
  }
}

export const logger = new Logger();
