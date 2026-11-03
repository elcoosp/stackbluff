import { getPlatformSurface } from '@stackbluff/shared/src/platform/surface';

/**
 * App preferences (Task 3-b cont.) — kvStorage-backed settings used by the
 * settings screens (appearance / audio / notifications).
 *
 * Storage goes through the configured platform surface (`AsyncStorage` on
 * native, injected by services/native/platform.ts at boot), so the settings
 * module stays free of RN imports and the web defaults keep working in tests.
 *
 * Audio gating contract (Task 3-b): the audio toggle writes
 * `prefs.audioEnabled` AND applies it immediately via the shared surface
 * `audio.setEnabled()` — the same surface the shared feedback controller
 * calls for simple backends. The boot applier below restores it on launch.
 */

export const PREF_KEYS = {
  audioEnabled: 'prefs.audioEnabled',
  hapticsEnabled: 'prefs.hapticsEnabled',
  feltColor: 'prefs.feltColor',
  notificationPreferences: 'prefs.notificationPreferences',
} as const;

export async function getBoolPref(key: string): Promise<boolean | null> {
  try {
    const raw = await getPlatformSurface().kvStorage.getItem(key);
    if (raw === null) return null;
    return raw === '1';
  } catch {
    return null;
  }
}

export async function setBoolPref(key: string, value: boolean): Promise<void> {
  try {
    await getPlatformSurface().kvStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Non-fatal — the setting just won't persist across launches.
  }
}

export async function getStringPref(key: string): Promise<string | null> {
  try {
    return await getPlatformSurface().kvStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setStringPref(key: string, value: string): Promise<void> {
  try {
    await getPlatformSurface().kvStorage.setItem(key, value);
  } catch {
    // Non-fatal.
  }
}

/**
 * Restore persisted feedback prefs at boot: currently the audio enable flag
 * (the one pref with a live surface hook — `audio.setEnabled`). Haptics
 * gating is persisted for parity but the shared feedback controller keeps
 * its own in-memory prefs on native (no public setter yet) — noted in the
 * worklog as a follow-up for the integrator.
 */
export async function applyFeedbackPrefsAtBoot(): Promise<void> {
  const audioEnabled = await getBoolPref(PREF_KEYS.audioEnabled);
  if (audioEnabled !== null) {
    getPlatformSurface().audio.setEnabled(audioEnabled);
  }
}
