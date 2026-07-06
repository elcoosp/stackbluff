/**
 * Application constants - single source of truth for all magic numbers
 */

// Time intervals (milliseconds)
export const TIME = {
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  THIRTY_SECONDS: 30 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
} as const;

// File upload limits (bytes)
export const FILE_SIZE = {
  LOGO_MAX: 5 * 1024 * 1024, // 5MB
  BANNER_MAX: 10 * 1024 * 1024, // 10MB
} as const;

// Pagination
export const PAGINATION = {
  MEMBERS_PER_DIVISION: 500,
  TOURNAMENTS_PER_PAGE: 20,
} as const;

// Tournament limits
export const TOURNAMENT = {
  MIN_PLAYERS: 10,
  MAX_PLAYERS: 500,
  MIN_BUY_IN: 0,
} as const;

// WebSocket
export const WEBSOCKET = {
  MAX_RECONNECT_ATTEMPTS: 5,
  BASE_RECONNECT_DELAY: 1000, // 1 second
} as const;

// API
export const API = {
  DEFAULT_RETRY_COUNT: 2,
  STALE_TIME_SHORT: 30 * 1000, // 30 seconds
  STALE_TIME_MEDIUM: 60 * 1000, // 1 minute
  STALE_TIME_LONG: 5 * 60 * 1000, // 5 minutes
  ONE_MINUTE: 60 * 1000,
} as const;
