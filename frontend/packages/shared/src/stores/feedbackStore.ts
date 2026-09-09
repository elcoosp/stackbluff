import { create } from 'zustand';
import type { FeedbackPreferences } from '../services/feedback/types';
import { DEFAULT_PREFERENCES } from '../services/feedback/types';

const STORAGE_KEY = 'stackbluff-feedback-prefs';

function loadPrefs(): FeedbackPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PREFERENCES };
}

function savePrefs(prefs: FeedbackPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

interface FeedbackStore extends FeedbackPreferences {
  setMasterEnabled: (v: boolean) => void;
  setHapticsEnabled: (v: boolean) => void;
  setAudioEnabled: (v: boolean) => void;
  setHapticIntensity: (v: number) => void;
  setAudioVolume: (v: number) => void;
  setSpatialAudio: (v: boolean) => void;
  setAdaptiveFeedback: (v: boolean) => void;
  updatePreferences: (partial: Partial<FeedbackPreferences>) => void;
  resetToDefaults: () => void;
}

export const useFeedbackStore = create<FeedbackStore>((set, get) => ({
  ...loadPrefs(),

  setMasterEnabled: (v) => {
    set({ masterEnabled: v });
    savePrefs(get());
  },
  setHapticsEnabled: (v) => {
    set({ hapticsEnabled: v });
    savePrefs(get());
  },
  setAudioEnabled: (v) => {
    set({ audioEnabled: v });
    savePrefs(get());
  },
  setHapticIntensity: (v) => {
    set({ hapticIntensity: Math.max(0, Math.min(1, v)) });
    savePrefs(get());
  },
  setAudioVolume: (v) => {
    set({ audioVolume: Math.max(0, Math.min(1, v)) });
    savePrefs(get());
  },
  setSpatialAudio: (v) => {
    set({ spatialAudio: v });
    savePrefs(get());
  },
  setAdaptiveFeedback: (v) => {
    set({ adaptiveFeedback: v });
    savePrefs(get());
  },
  updatePreferences: (partial) => {
    set(partial);
    savePrefs(get());
  },
  resetToDefaults: () => {
    set({ ...DEFAULT_PREFERENCES });
    savePrefs(DEFAULT_PREFERENCES);
  },
}));
