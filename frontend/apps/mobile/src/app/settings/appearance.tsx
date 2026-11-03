import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { getStringPref, PREF_KEYS, setStringPref } from '../../lib/prefs';
import { toast } from '../../lib/toast';
import { Screen } from '../../screens/Screen';
import { SkeletonList, TextField } from '../../screens/ui';

/**
 * Appearance settings — port of PWA routes/settings/appearance.tsx: felt
 * color swatch grid + custom hex + live felt preview. Persisted through the
 * platform surface kvStorage (AsyncStorage) so the table UI (A3) can read
 * the same key.
 */

const VALID_COLORS = [
  '#1a6b42',
  '#2d7a5a',
  '#3d8b6b',
  '#4a9c7a',
  '#5aad8a',
  '#0f4c3a',
  '#1e5945',
  '#2a6650',
];

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export default function AppearanceSettingsScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const [feltColor, setFeltColor] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getStringPref(PREF_KEYS.feltColor).then((stored) => {
      if (!mounted) return;
      setFeltColor(stored ?? VALID_COLORS[0]);
      setCustomColor(stored ?? VALID_COLORS[0]);
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const applyColor = (color: string) => {
    if (!HEX_PATTERN.test(color)) return;
    setFeltColor(color);
    setCustomColor(color);
    void setStringPref(PREF_KEYS.feltColor, color);
    toast.success('Felt color updated');
  };

  if (!guarded || !loaded || feltColor === null) {
    return (
      <Screen title="Appearance" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  return (
    <Screen
      title="Appearance"
      subtitle="Felt color and table visuals. The felt applies to new tables."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
        <Surface variant="card" radius={radii.base} style={styles.card}>
          <AppText variant="label">FELT COLOR</AppText>
          <View style={styles.swatchRow}>
            {VALID_COLORS.map((color) => (
              <PressableScale key={color} onPress={() => applyColor(color)}>
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    feltColor === color ? styles.swatchActive : null,
                  ]}
                />
              </PressableScale>
            ))}
          </View>
          <TextField
            label="Custom color (hex)"
            value={customColor}
            onChangeText={setCustomColor}
            placeholder="#1a6b42"
          />
          {HEX_PATTERN.test(customColor) && customColor !== feltColor ? (
            <PressableScale onPress={() => applyColor(customColor)}>
              <Text style={styles.applyLink}>APPLY CUSTOM COLOR</Text>
            </PressableScale>
          ) : customColor !== feltColor ? (
            <Text style={styles.hint}>Enter a valid 6-digit hex color (e.g. #1a6b42).</Text>
          ) : null}
        </Surface>

        {/* Felt preview */}
        <View style={styles.preview}>
          <View style={[styles.feltPreview, { backgroundColor: feltColor }]}>
            <Text style={styles.previewLabel}>FELT PREVIEW</Text>
            <View style={styles.previewChips}>
              {Array.from({ length: 3 }, (_, i) => (
                <View
                  // biome-ignore lint/suspicious/noArrayIndexKey: decorative chips
                  key={i}
                  style={styles.previewChip}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14, paddingBottom: 24 },
  card: { padding: 16, gap: 12 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  swatchActive: { borderColor: colors.accent },
  applyLink: {
    fontFamily: fonts.labelCaps,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.accent,
  },
  hint: { fontSize: 11, color: colors.mutedForeground },
  preview: { gap: 8 },
  feltPreview: {
    height: 120,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    justifyContent: 'center',
    gap: 10,
  },
  previewLabel: {
    fontFamily: fonts.labelCaps,
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.8)',
  },
  previewChips: { flexDirection: 'row', gap: 8 },
  previewChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
  },
});
