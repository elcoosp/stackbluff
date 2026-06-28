/**
 * Centralized error handling with differentiation by HTTP status
 */

import { toast } from 'sonner';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleApiError(error: unknown, context: Record<string, unknown> = {}): void {
  const loggerWithContext = logger.withContext(context);

  if (error instanceof AppError) {
    loggerWithContext.error(error.message, error, error.context);

    switch (error.statusCode) {
      case 401:
        toast.error('Authentication required', {
          description: 'Please log in to continue',
        });
        // TODO: Redirect to login
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

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  context: Record<string, unknown> = {}
): Promise<T> {
  try {
    const { apiClient } = await import('@stackbluff/shared/api/client');
    return await apiClient<T>(endpoint, options);
  } catch (error) {
    if (error instanceof Error) {
      const statusMatch = error.message.match(/HTTP (\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : undefined;
      throw new AppError(error.message, statusCode, undefined, context);
    }
    throw error;
  }
}
