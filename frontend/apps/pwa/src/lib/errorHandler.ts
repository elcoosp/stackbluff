/**
 * Centralized error handling with differentiation by HTTP status
 * Includes request correlation IDs for tracing
 * Friendly user-facing messages for known backend errors
 */

import { apiClient } from '@stackbluff/shared/api/client';
import { toast } from 'sonner';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public context?: Record<string, unknown>,
    public correlationId?: string,
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

// Lockout state management
let lockoutEndTime: number | null = null;
let lockoutInterval: NodeJS.Timeout | null = null;

export function getLockoutRemaining(): number {
  if (!lockoutEndTime) return 0;
  return Math.max(0, Math.round((lockoutEndTime - Date.now()) / 1000));
}

export function isAccountLocked(): boolean {
  if (!lockoutEndTime) return false;
  return Date.now() < lockoutEndTime;
}

export function setAccountLockout(durationSeconds: number): void {
  lockoutEndTime = Date.now() + durationSeconds * 1000;
  if (lockoutInterval) {
    clearInterval(lockoutInterval);
    lockoutInterval = null;
  }
  lockoutInterval = setInterval(() => {
    if (getLockoutRemaining() <= 0) {
      lockoutEndTime = null;
      if (lockoutInterval) {
        clearInterval(lockoutInterval);
        lockoutInterval = null;
      }
    }
  }, 1000);
}

export function clearLockout(): void {
  lockoutEndTime = null;
  if (lockoutInterval) {
    clearInterval(lockoutInterval);
    lockoutInterval = null;
  }
}

/**
 * Map backend error codes to user-friendly messages
 * Returns null if no specific message is available
 */
function getUserFriendlyMessage(error: unknown, statusCode?: number): string | null {
  if (error instanceof AppError) {
    const msg = error.message || '';

    // Transfer limit exceeded
    if (msg.includes('TransferLimitExceeded') || msg.includes('Transfer limit exceeded')) {
      const match = msg.match(/\d+/);
      const limit = match ? parseInt(match[0], 10) : 5000;
      return `You've reached the daily chip transfer limit (${limit}). Try again tomorrow.`;
    }

    // Rate limiting
    if (msg.includes('RateLimited') || msg.includes('Rate limited') || statusCode === 429) {
      return "Slow down! You're acting too fast. Please wait a moment before trying again.";
    }

    // Tournament full
    if (msg.includes('TournamentFull') || msg.includes('tournament is full')) {
      return 'This tournament is full. Please join another one.';
    }

    // Registration closed
    if (msg.includes('TournamentRegistrationClosed') || msg.includes('registration is closed')) {
      return 'Registration for this tournament is closed.';
    }

    // Tournament already started
    if (msg.includes('TournamentAlreadyStarted') || msg.includes('already started')) {
      return 'This tournament has already started.';
    }

    // Invalid seat
    if (msg.includes('InvalidSeat') || msg.includes('Invalid seat')) {
      return 'That seat is taken or invalid. Please try another seat.';
    }

    // Insufficient balance
    if (msg.includes('Insufficient balance') || msg.includes('insufficient balance')) {
      return "You don't have enough chips for this buy-in.";
    }

    // Not enough players
    if (msg.includes('Not enough players') || msg.includes('Need at least 2 players')) {
      return 'Need at least 2 players to start a hand.';
    }

    // Already registered
    if (msg.includes('Already registered') || msg.includes('already registered')) {
      return 'You are already registered for this tournament.';
    }

    // Not registered
    if (msg.includes('Not registered') || msg.includes('not registered')) {
      return 'You are not registered for this tournament.';
    }

    // Permission denied
    if (msg.includes('Permission denied') || msg.includes('Forbidden')) {
      return "You don't have permission to perform this action.";
    }

    // Not found
    if (msg.includes('NotFound') || statusCode === 404) {
      return 'The requested resource was not found.';
    }

    // Validation error
    if (msg.includes('Validation error') || msg.includes('Invalid input')) {
      return 'Please check your input and try again.';
    }

    // Database error
    if (msg.includes('Database error') || msg.includes('database error')) {
      return 'A database error occurred. Please try again later.';
    }

    // Internal server error
    if (statusCode && statusCode >= 500) {
      return 'Something went wrong on our end. Please try again later.';
    }
  }

  return null;
}

/**
 * Handle API errors with appropriate user feedback
 */
export function handleApiError(error: unknown, context: Record<string, unknown> = {}): void {
  const correlationId = (context.correlationId as string) || generateCorrelationId();
  const loggerWithContext = logger.child({ ...context, correlationId });

  const userMessage = getUserFriendlyMessage(error);
  let _statusCode: number | undefined;

  if (error instanceof AppError) {
    _statusCode = error.statusCode;
    loggerWithContext.error(error.message, error, error.context);
  } else if (error instanceof Error) {
    loggerWithContext.error('Unexpected error', error);
  } else {
    loggerWithContext.error('Unknown error occurred');
  }

  // If we have a friendly message, use it; otherwise fallback to generic
  if (userMessage) {
    toast.error(userMessage);
    return;
  }

  // Default handling based on status code
  if (error instanceof AppError) {
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
      case 429:
        if (error.message?.includes('Account temporarily locked')) {
          const match = error.message.match(/(\d+)\s*second/);
          const seconds = match ? parseInt(match[1], 10) : 900;
          setAccountLockout(seconds);
          toast.error('Account locked', {
            description: `Too many failed attempts. Try again in ${Math.ceil(seconds / 60)} minutes.`,
          });
        } else {
          toast.error('Too many requests', {
            description: error.message,
          });
        }
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
    toast.error('Unexpected error', {
      description: error.message,
    });
  } else {
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
  context: Record<string, unknown> = {},
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
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

      loggerWithContext.error('API request failed', error, { statusCode });
      throw new AppError(error.message, statusCode, undefined, context, correlationId);
    }
    throw error;
  }
}
