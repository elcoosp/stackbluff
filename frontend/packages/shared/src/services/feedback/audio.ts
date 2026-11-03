/**
 * Audio — moved to `platform/web-defaults.ts` (RN surface refactor).
 * This module re-exports the web engine so existing import paths keep
 * working (public API unchanged).
 *
 * Note: the rich play API is now `audioEngine.playSound(sound, prefs,
 * overrides)`; `audioEngine.play(preset, opts?)` is the platform-surface
 * compatible method.
 */
export { AudioEngine, audioEngine } from '../../platform/web-defaults';
