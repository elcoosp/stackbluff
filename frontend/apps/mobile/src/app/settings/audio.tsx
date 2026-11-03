import { getPlatformSurface } from '@stackbluff/shared/src/platform/surface';
import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { applyFeedbackPrefsAtBoot, getBoolPref, PREF_KEYS, setBoolPref } from '../../lib/prefs';
import { toast } from '../../lib/toast';
import { Screen } from '../../screens/Screen';
import { SkeletonList, Toggle } from '../../screens/ui';

/**
 * Audio & haptics settings — port of PWA routes/settings/audio.tsx, adapted
 * to the native surface:
 *
 *  - Sound effects toggle → shared surface `audio.setEnabled(v)` (the exact
 *    seam the shared feedback controller consults for simple backends) and
 *    persisted in kvStorage; `applyFeedbackPrefsAtBoot()` restores it at
 *    launch (wired in providers.tsx).
 *  - Haptics toggle → persisted pref (kvStorage). The shared feedback
 *    controller keeps its own in-memory prefs on native (no public setter),
 *    so the persisted flag is the app-level source of truth — integrator
 *    follow-up noted in the worklog.
 *  - Volume sliders from the PWA are web-audio-only; the native audio
 *    backend currently exposes enable/disable only (A6 asset-backed backend
 *    will add volume) — the "Test sound" button exercises `audio.play`.
 */

export default function AudioSettingsScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const [audioEnabled, setAudioEnabled] = useState<boolean | null>(null);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const [audio, haptics] = await Promise.all([
        getBoolPref(PREF_KEYS.audioEnabled),
        getBoolPref(PREF_KEYS.hapticsEnabled),
      ]);
      if (!mounted) return;
      setAudioEnabled(audio ?? true);
      setHapticsEnabled(haptics ?? true);
      setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!guarded || !loaded || audioEnabled === null || hapticsEnabled === null) {
    return (
      <Screen title="Audio" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={2} />
      </Screen>
    );
  }

  const handleAudioToggle = (value: boolean) => {
    setAudioEnabled(value);
    getPlatformSurface().audio.setEnabled(value);
    void setBoolPref(PREF_KEYS.audioEnabled, value);
  };

  const handleHapticsToggle = (value: boolean) => {
    setHapticsEnabled(value);
    void setBoolPref(PREF_KEYS.hapticsEnabled, value);
  };

  const handleTestSound = () => {
    getPlatformSurface().audio.play('chipClink', { volume: 0.8 });
    toast.info('Test sound played');
  };

  return (
    <Screen
      title="Audio Settings"
      subtitle="Sound effects and haptic feedback."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <ScrollView contentContainerStyle={styles.stack}>
        <Surface variant="card" radius={radii.base} style={styles.rowCard}>
          <View style={styles.rowText}>
            <AppText variant="body">Sound Effects</AppText>
            <AppText variant="label" style={styles.rowHint}>
              Card deals, chip sounds and table alerts
            </AppText>
          </View>
          <Toggle value={audioEnabled} onValueChange={handleAudioToggle} />
        </Surface>

        <Surface variant="card" radius={radii.base} style={styles.rowCard}>
          <View style={styles.rowText}>
            <AppText variant="body">Haptic Feedback</AppText>
            <AppText variant="label" style={styles.rowHint}>
              Vibration on your turn, wins and actions
            </AppText>
          </View>
          <Toggle value={hapticsEnabled} onValueChange={handleHapticsToggle} />
        </Surface>

        <Surface variant="card" radius={radii.base} style={styles.testCard}>
          <AppText variant="label">TEST</AppText>
          <PressableScale onPress={handleTestSound} disabled={!audioEnabled}>
            <View style={[styles.testBtn, !audioEnabled && styles.testBtnDisabled]}>
              <Text style={styles.testBtnLabel}>PLAY TEST SOUND</Text>
            </View>
          </PressableScale>
          <Text style={styles.note}>
            Audio assets ship with the native game sound pack. Until then the backend is
            enable-aware but silent on device.
          </Text>
        </Surface>

        <PressableScale onPress={() => void applyFeedbackPrefsAtBoot()}>
          <Text style={styles.reapplyLink}>RE-APPLY SAVED PREFERENCES</Text>
        </PressableScale>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: 24 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowHint: {
    textTransform: 'none',
    letterSpacing: 0,
    color: colors.mutedForeground,
  },
  testCard: { padding: 16, gap: 10 },
  testBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  testBtnDisabled: { opacity: 0.4 },
  testBtnLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
  },
  note: { fontSize: 11, color: colors.mutedForeground, lineHeight: 16 },
  reapplyLink: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 6,
  },
});
