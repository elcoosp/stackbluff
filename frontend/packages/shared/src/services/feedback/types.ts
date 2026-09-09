/**
 * Feedback event types mapped to poker game actions.
 * Each event triggers a coordinated haptic + audio + visual response.
 */
export type FeedbackEvent =
  | 'cardDeal'
  | 'cardFlip'
  | 'chipClink'
  | 'bet'
  | 'raise'
  | 'check'
  | 'call'
  | 'fold'
  | 'allIn'
  | 'win'
  | 'lose'
  | 'buttonClick'
  | 'sliderTick'
  | 'sliderConfirm'
  | 'timerTick'
  | 'timerUrgent'
  | 'timerFinal'
  | 'error'
  | 'notification'
  | 'potCollect'
  | 'roundStart'
  | 'roundEnd'
  | 'dealCommunity'
  | 'showdown'
  | 'playerJoin'
  | 'playerLeave';

/** Vibration API pattern — single duration or [vibrate, pause, vibrate, …] */
export type HapticPattern = number | number[];

/** Procedural sound identifiers */
export type SoundType =
  | 'cardFlip'
  | 'chipClink'
  | 'chipStack'
  | 'softTap'
  | 'risingTone'
  | 'fallingTone'
  | 'dramaticHit'
  | 'fanfare'
  | 'defeat'
  | 'click'
  | 'tick'
  | 'urgentTick'
  | 'errorBuzz'
  | 'chime'
  | 'whoosh'
  | 'settle';

export interface FeedbackConfig {
  haptic: HapticPattern | null;
  sound: SoundType;
  /** 0–1 multiplier on top of master volume */
  volume?: number;
  /** –1 (left) to 1 (right) for spatial panning */
  pan?: number;
  /** 0.5–2.0 pitch multiplier */
  pitch?: number;
  visual?: {
    glow?: string;
    shake?: number;
    pulse?: boolean;
  };
}

export interface FeedbackPreferences {
  masterEnabled: boolean;
  hapticsEnabled: boolean;
  audioEnabled: boolean;
  hapticIntensity: number;
  audioVolume: number;
  spatialAudio: boolean;
  adaptiveFeedback: boolean;
}

export const DEFAULT_PREFERENCES: FeedbackPreferences = {
  masterEnabled: true,
  hapticsEnabled: true,
  audioEnabled: true,
  hapticIntensity: 0.7,
  audioVolume: 0.6,
  spatialAudio: true,
  adaptiveFeedback: true,
};

/** Seat positions around a poker table (9-max) for spatial panning */
export const SEAT_PAN_MAP: Record<number, number> = {
  0: 0, // Hero (center)
  1: -0.8, // Left
  2: -0.5, // Far left
  3: -0.2, // Near left
  4: 0.2, // Near right
  5: 0.5, // Far right
  6: 0.8, // Right
  7: -0.6, // Bottom left
  8: 0.6, // Bottom right
};
