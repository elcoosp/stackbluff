/**
 * Centralized error handling with differentiation by HTTP status
 * Includes request correlation IDs for tracing
 */

import { toast } from 'sonner';
import { apiClient } from '@stackbluff/shared/api/client';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public context?: Record<string, unknown>,
    public correlationId?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Generate a unique correlation ID for request tracing
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Handle API errors with appropriate user feedback
 */
export function handleApiError(error: unknown, context: Record<string, unknown> = {}): void {
  const correlationId = context.correlationId as string || generateCorrelationId();
  const loggerWithContext = logger.child({ ...context, correlationId });

  if (error instanceof AppError) {
    loggerWithContext.error(error.message, error, error.context);

    switch (error.statusCode) {
      case 401:
        toast.error('Authentication required', {
          description: 'Please log in to continue',
        });
        break;
      case 403:
        toast.error('Permission denied', {
          description: error.message,
        });
        break;
      case 404:
        toast.error('Not found', {
          description: error.message,
        });
        break;
      case 409:
        toast.error('Conflict', {
          description: error.message,
        });
        break;
      case 422:
        toast.error('Validation error', {
          description: error.message,
        });
        break;
      case 500:
      case 502:
      case 503:
        toast.error('Server error', {
          description: 'Please try again later',
        });
        break;
      default:
        toast.error('Error', {
          description: error.message,
        });
    }
  } else if (error instanceof Error) {
    loggerWithContext.error('Unexpected error', error);
    toast.error('Unexpected error', {
      description: error.message,
    });
  } else {
    loggerWithContext.error('Unknown error occurred');
    toast.error('Unknown error', {
      description: 'An unexpected error occurred',
    });
  }
}

/**
 * Wrapper around apiClient with correlation ID tracking
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  context: Record<string, unknown> = {}
): Promise<T> {
  const correlationId = generateCorrelationId();
  const loggerWithContext = logger.child({ ...context, correlationId, endpoint });

  try {
    const headers = new Headers(options.headers);
    headers.set('X-Correlation-ID', correlationId);

    const result = await apiClient<T>(endpoint, {
      ...options,
      headers,
    });

    loggerWithContext.info('API request successful');
    return result;
  } catch (error) {
    if (error instanceof Error) {
      const statusMatch = error.message.match(/HTTP (\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : undefined;

      loggerWithContext.error('API request failed', error, { statusCode });
      throw new AppError(error.message, statusCode, undefined, context, correlationId);
    }
    throw error;
  }
}
