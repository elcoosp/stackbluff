/**
 * Haptics — moved to `platform/web-defaults.ts` (RN surface refactor).
 * This module re-exports the web engine so existing import paths keep
 * working (public API unchanged).
 */
export { HapticEngine, hapticEngine } from '../../platform/web-defaults';
