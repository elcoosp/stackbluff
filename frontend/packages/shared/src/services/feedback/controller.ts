import { audioEngine } from './audio';
import { hapticEngine } from './haptics';
import { FEEDBACK_PRESETS } from './presets';
import type { FeedbackEvent, FeedbackPreferences } from './types';
import { DEFAULT_PREFERENCES } from './types';

class FeedbackController {
  private prefs: FeedbackPreferences = { ...DEFAULT_PREFERENCES };
  private adaptiveMultiplier = 1;
  private initialized = false;

  setPreferences(prefs: FeedbackPreferences): void {
    this.prefs = prefs;
    if (this.initialized) {
      audioEngine.setVolume(prefs.audioVolume);
    }
  }

  getPreferences(): FeedbackPreferences {
    return { ...this.prefs };
  }

  setAdaptiveMultiplier(m: number): void {
    this.adaptiveMultiplier = this.prefs.adaptiveFeedback ? m : 1;
  }

  async init(): Promise<void> {
    if (this.initialized) {
      await audioEngine.resume();
      return;
    }
    await audioEngine.init();
    audioEngine.setVolume(this.prefs.audioVolume);
    this.initialized = true;
  }

  async resume(): Promise<void> {
    await audioEngine.resume();
  }

  trigger(
    event: FeedbackEvent,
    overrides?: { pan?: number; volume?: number; pitch?: number; seatIndex?: number },
  ): void {
    const preset = FEEDBACK_PRESETS[event];
    if (!preset) return;

    if (preset.haptic) {
      hapticEngine.trigger(preset.haptic, {
        ...this.prefs,
        hapticIntensity: this.prefs.hapticIntensity * this.adaptiveMultiplier,
      });
    }

    audioEngine.play(preset.sound, this.prefs, {
      volume: (overrides?.volume ?? preset.volume ?? 1) * this.adaptiveMultiplier,
      pan: overrides?.pan ?? preset.pan,
      pitch: overrides?.pitch ?? preset.pitch,
    });

    if (preset.visual && this.prefs.masterEnabled) {
      const detail: any = { event, ...preset.visual };
      if (overrides?.seatIndex !== undefined) detail.seatIndex = overrides.seatIndex;
      window.dispatchEvent(new CustomEvent('feedback:visual', { detail }));
    }
  }

  cancelHaptics(): void {
    hapticEngine.cancel();
  }

  isHapticSupported(): boolean {
    return hapticEngine.isSupported();
  }

  isAudioReady(): boolean {
    return audioEngine.isReady();
  }
}

/** Module-level singleton */
export const feedbackController = new FeedbackController();
