import type { HapticsBackend } from '../../platform/surface';
import { getPlatformSurface } from '../../platform/surface';
import type { AudioEngine, HapticEngine } from '../../platform/web-defaults';
import { FEEDBACK_PRESETS } from './presets';
import type { FeedbackEvent, FeedbackPreferences, HapticPattern } from './types';
import { DEFAULT_PREFERENCES } from './types';

/**
 * Feedback controller — routes haptics/audio through the platform surface
 * (`getPlatformSurface()`).
 *
 * - Web default: the surface hands back the original rich engines
 *   (`HapticEngine` / `AudioEngine` from platform/web-defaults), so the
 *   exact pre-surface behavior (vibration patterns, spatial audio, prefs
 *   gating, voice limiting) is preserved.
 * - Native platforms: the injected backends only expose the simple surface
 *   interface (`impact/success/...`, `play(preset, { volume })`), and the
 *   controller degrades gracefully (prefs gating + pattern→style mapping).
 */
class FeedbackController {
  private prefs: FeedbackPreferences = { ...DEFAULT_PREFERENCES };
  private adaptiveMultiplier = 1;
  private initialized = false;

  setPreferences(prefs: FeedbackPreferences): void {
    this.prefs = prefs;
    if (this.initialized) {
      const audio = getPlatformSurface().audio as AudioEngine;
      if (typeof audio.setVolume === 'function') {
        audio.setVolume(prefs.audioVolume);
      }
    }
  }

  getPreferences(): FeedbackPreferences {
    return { ...this.prefs };
  }

  setAdaptiveMultiplier(m: number): void {
    this.adaptiveMultiplier = this.prefs.adaptiveFeedback ? m : 1;
  }

  async init(): Promise<void> {
    const audio = getPlatformSurface().audio as AudioEngine;
    if (this.initialized) {
      if (typeof audio.resume === 'function') {
        await audio.resume();
      }
      return;
    }
    if (typeof audio.init === 'function') {
      await audio.init();
    }
    if (typeof audio.setVolume === 'function') {
      audio.setVolume(this.prefs.audioVolume);
    }
    this.initialized = true;
  }

  async resume(): Promise<void> {
    const audio = getPlatformSurface().audio as AudioEngine;
    if (typeof audio.resume === 'function') {
      await audio.resume();
    }
  }

  trigger(
    event: FeedbackEvent,
    overrides?: { pan?: number; volume?: number; pitch?: number; seatIndex?: number },
  ): void {
    const preset = FEEDBACK_PRESETS[event];
    if (!preset) return;

    const surface = getPlatformSurface();

    if (preset.haptic) {
      const haptics = surface.haptics as HapticEngine;
      const scaledPrefs = {
        ...this.prefs,
        hapticIntensity: this.prefs.hapticIntensity * this.adaptiveMultiplier,
      };
      if (typeof haptics.trigger === 'function') {
        // Rich backend (web default): same pattern pipeline as before.
        haptics.trigger(preset.haptic, scaledPrefs);
      } else if (
        this.prefs.masterEnabled &&
        this.prefs.hapticsEnabled &&
        scaledPrefs.hapticIntensity > 0
      ) {
        // Simple backend (native): map the pattern to a device primitive.
        this.triggerSimpleHaptic(surface.haptics, event, preset.haptic);
      }
    }

    const audio = surface.audio as AudioEngine;
    if (typeof audio.playSound === 'function') {
      // Rich backend (web default): identical call to the pre-surface engine.
      audio.playSound(preset.sound, this.prefs, {
        volume: (overrides?.volume ?? preset.volume ?? 1) * this.adaptiveMultiplier,
        pan: overrides?.pan ?? preset.pan,
        pitch: overrides?.pitch ?? preset.pitch,
      });
    } else if (this.prefs.masterEnabled && this.prefs.audioEnabled) {
      // Simple backend (native).
      audio.play(preset.sound, {
        volume: (overrides?.volume ?? preset.volume ?? 1) * this.adaptiveMultiplier,
      });
    }

    if (preset.visual && this.prefs.masterEnabled) {
      const detail: {
        event: FeedbackEvent;
        glow?: string;
        shake?: number;
        pulse?: boolean;
        seatIndex?: number;
      } = { event, ...preset.visual };
      if (overrides?.seatIndex !== undefined) detail.seatIndex = overrides.seatIndex;
      window.dispatchEvent(new CustomEvent('feedback:visual', { detail }));
    }
  }

  cancelHaptics(): void {
    const haptics = getPlatformSurface().haptics as HapticEngine;
    if (typeof haptics.cancel === 'function') {
      haptics.cancel();
    }
  }

  isHapticSupported(): boolean {
    const haptics = getPlatformSurface().haptics as HapticEngine;
    if (typeof haptics.isSupported === 'function') {
      return haptics.isSupported();
    }
    return true;
  }

  isAudioReady(): boolean {
    const audio = getPlatformSurface().audio as AudioEngine;
    if (typeof audio.isReady === 'function') {
      return audio.isReady();
    }
    return true;
  }

  /** Fallback for backends that only implement the HapticsBackend interface. */
  private triggerSimpleHaptic(
    haptics: HapticsBackend,
    event: FeedbackEvent,
    pattern: HapticPattern,
  ): void {
    if (event === 'error') {
      haptics.error();
      return;
    }
    if (event === 'win' || event === 'allIn') {
      haptics.success();
      return;
    }
    if (event === 'timerUrgent' || event === 'timerFinal') {
      haptics.warning();
      return;
    }
    const vibrateMs =
      typeof pattern === 'number'
        ? pattern
        : pattern.filter((_, idx) => idx % 2 === 0).reduce((sum, val) => sum + val, 0);
    const style = vibrateMs <= 10 ? 'light' : vibrateMs <= 40 ? 'medium' : 'heavy';
    haptics.impact(style);
  }
}

/** Module-level singleton */
export const feedbackController = new FeedbackController();
