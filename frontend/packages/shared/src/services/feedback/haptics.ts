import type { FeedbackPreferences, HapticPattern } from './types';

/**
 * HapticEngine — wraps the Vibration API with intensity scaling,
 * smart pattern normalization, and graceful fallback.
 *
 * Design decisions:
 * - Odd-indexed values in patterns are pauses; we preserve rhythm
 *   by scaling pauses less aggressively than vibration durations.
 * - Zero-duration vibrations are stripped to avoid API inconsistencies.
 * - Overlapping calls auto-cancel the previous vibration (browser-native).
 */
export class HapticEngine {
  private supported: boolean;

  constructor() {
    this.supported =
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator &&
      typeof navigator.vibrate === 'function';
  }

  isSupported(): boolean {
    return this.supported;
  }

  trigger(pattern: HapticPattern, prefs: FeedbackPreferences): void {
    if (!this.supported || !prefs.masterEnabled || !prefs.hapticsEnabled) return;
    if (prefs.hapticIntensity <= 0) return;

    const normalized = this.normalize(pattern, prefs.hapticIntensity);
    if (this.isEmpty(normalized)) return;

    try {
      navigator.vibrate(normalized);
    } catch {
      // Silently fail — some browsers throw in certain contexts
    }
  }

  cancel(): void {
    if (this.supported) {
      try {
        navigator.vibrate(0);
      } catch {
        /* noop */
      }
    }
  }

  private normalize(pattern: HapticPattern, intensity: number): HapticPattern {
    if (typeof pattern === 'number') {
      return Math.max(0, Math.round(pattern * intensity));
    }

    return pattern
      .map((val, idx) => {
        if (idx % 2 === 0) {
          // Vibration duration — scale with intensity
          return Math.max(0, Math.round(val * intensity));
        }
        // Pause duration — preserve rhythm (scale less aggressively)
        return Math.max(0, Math.round(val * (0.4 + 0.6 * intensity)));
      })
      .filter((val, idx, arr) => {
        // Strip trailing zeros and consecutive zero-pairs
        if (val === 0 && idx % 2 === 0 && idx === arr.length - 1) return false;
        return true;
      });
  }

  private isEmpty(pattern: HapticPattern): boolean {
    if (typeof pattern === 'number') return pattern <= 0;
    return pattern.length === 0 || pattern.every((v) => v === 0);
  }
}

export const hapticEngine = new HapticEngine();
