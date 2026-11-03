import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { api, type NotificationSettings as NotificationPrefs } from '../../lib/api';
import { getBoolPref, PREF_KEYS, setBoolPref } from '../../lib/prefs';
import { toast } from '../../lib/toast';
import { Screen } from '../../screens/Screen';
import { ActionButton, SkeletonList, Toggle } from '../../screens/ui';
import { registerForPushNotificationsAsync } from '../../services/native';

/**
 * Notification settings — port of PWA routes/settings/notifications.tsx:
 *  - Push registration section: the web push/ServiceWorker flow becomes the
 *    native expo-notifications flow (permissions → Expo push token →
 *    `POST /push/register`, Agent-06 service). Status reflects the OS
 *    permission state.
 *  - Preference toggles: server-synced via GET/PATCH
 *    `/notifications/preferences` (same contract as the PWA
 *    NotificationPreferences component), with local first-run defaults.
 */

const PREF_DEFAULTS: NotificationPrefs = {
  tournamentReminder60: true,
  tournamentReminder10: true,
  tournamentResults: true,
  clubAnnouncements: true,
  friendActivity: true,
  promotional: false,
};

const PREF_ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  {
    key: 'tournamentReminder60',
    label: 'Tournament reminder (60 min)',
    hint: 'Heads-up before your registered events start',
  },
  {
    key: 'tournamentReminder10',
    label: 'Tournament reminder (10 min)',
    hint: 'Final warning to take your seat',
  },
  { key: 'tournamentResults', label: 'Tournament results', hint: 'Final standings and prizes' },
  { key: 'clubAnnouncements', label: 'Club announcements', hint: 'Messages from your club owners' },
  { key: 'friendActivity', label: 'Friend activity', hint: 'When friends join tables or win big' },
  {
    key: 'promotional',
    label: 'Promotions',
    hint: 'Bonus chip offers and events (off by default)',
  },
];

type PushPermissionLabel = 'enabled' | 'not_set' | 'denied' | 'unknown';

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const queryClient = useQueryClient();

  /* ── Push permission state (expo-notifications) ─────────────────────── */
  const [permissionLabel, setPermissionLabel] = useState<PushPermissionLabel>('unknown');
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const settings = await Notifications.getPermissionsAsync();
        if (!mounted) return;
        setPermissionLabel(
          settings.granted ? 'enabled' : settings.canAskAgain ? 'not_set' : 'denied',
        );
      } catch {
        if (mounted) setPermissionLabel('unknown');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleEnablePush = async () => {
    setRegistering(true);
    const result = await registerForPushNotificationsAsync();
    setRegistering(false);
    if (result.registered) {
      setPermissionLabel('enabled');
      toast.success('Push notifications enabled');
    } else if (result.reason === 'permission-denied') {
      setPermissionLabel('denied');
      toast.error('Notification permission denied. Enable it in system settings.');
    } else if (result.reason === 'emulator') {
      toast.info('Remote push is not available on emulators/simulators.');
    } else if (result.reason === 'backend-rejected') {
      toast.error('Push token registered locally, but the backend rejected the device.');
    } else {
      toast.error('Could not enable push notifications right now.');
    }
  };

  /* ── Server-synced preferences (mirror PWA NotificationPreferences) ─── */
  const { data: remotePrefs, isLoading } = useQuery<Partial<NotificationPrefs>>({
    queryKey: ['notification-preferences'],
    queryFn: () => api.notificationPreferences(),
    enabled: guarded,
    staleTime: 60_000,
    retry: 1,
  });

  const [prefs, setPrefs] = useState<NotificationPrefs>(PREF_DEFAULTS);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    void (async () => {
      // Local first (per-key kvStorage booleans), then remote overrides —
      // mirrors the PWA's localStorage-then-server load order.
      let local = PREF_DEFAULTS;
      try {
        const entries = await Promise.all(
          (Object.keys(PREF_DEFAULTS) as (keyof NotificationPrefs)[]).map(async (key) => {
            const value = await getBoolPref(`${PREF_KEYS.notificationPreferences}.${key}`);
            return [key, value ?? PREF_DEFAULTS[key]] as const;
          }),
        );
        local = { ...PREF_DEFAULTS, ...Object.fromEntries(entries) } as NotificationPrefs;
      } catch {
        // fall back to defaults
      }
      setPrefs(local);
    })();
  }, []);

  useEffect(() => {
    if (remotePrefs) {
      setPrefs((current) => ({ ...current, ...remotePrefs }));
    }
  }, [remotePrefs]);

  const saveMutation = useMutation({
    mutationFn: (data: NotificationPrefs) => api.saveNotificationPreferences(data),
    onSuccess: () => {
      setIsDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Notification preferences saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save preferences'),
  });

  const togglePref = (key: keyof NotificationPrefs) => {
    setPrefs((current) => ({ ...current, [key]: !current[key] }));
    void setBoolPref(`${PREF_KEYS.notificationPreferences}.${key}`, !prefs[key]);
    setIsDirty(true);
  };

  if (!guarded) {
    return (
      <Screen title="Notifications" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  const permissionTone =
    permissionLabel === 'enabled'
      ? colors.accent
      : permissionLabel === 'denied'
        ? colors.error
        : colors.mutedForeground;

  return (
    <Screen
      title="Notification Settings"
      subtitle="Push alerts and per-event preferences."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <ScrollView contentContainerStyle={styles.stack}>
        {/* Push registration */}
        <Surface variant="card" radius={radii.base} style={styles.card}>
          <AppText variant="label">PUSH NOTIFICATIONS</AppText>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: permissionTone }]} />
            <Text style={[styles.statusText, { color: permissionTone }]}>
              {permissionLabel === 'enabled'
                ? 'Enabled'
                : permissionLabel === 'denied'
                  ? 'Blocked in system settings'
                  : permissionLabel === 'not_set'
                    ? 'Not enabled yet'
                    : 'Unknown'}
            </Text>
          </View>
          <Text style={styles.note}>
            Device registration uses Expo push tokens; the backend fans out tournament, club and
            friend events to your device.
          </Text>
          {permissionLabel !== 'enabled' ? (
            <ActionButton
              label={registering ? 'Enabling…' : 'Enable Push Notifications'}
              onPress={() => void handleEnablePush()}
              loading={registering}
            />
          ) : null}
        </Surface>

        {/* Preferences */}
        <Surface variant="card" radius={radii.base} style={styles.card}>
          <AppText variant="label">PREFERENCES</AppText>
          {isLoading ? (
            <SkeletonList rows={3} height={48} />
          ) : (
            PREF_ROWS.map((row) => (
              <View key={row.key} style={styles.prefRow}>
                <View style={styles.prefText}>
                  <AppText variant="body">{row.label}</AppText>
                  <AppText variant="label" style={styles.rowHint}>
                    {row.hint}
                  </AppText>
                </View>
                <Toggle value={prefs[row.key]} onValueChange={() => togglePref(row.key)} />
              </View>
            ))
          )}
          <Text style={styles.note}>
            Changes are saved to your account and synced across devices.
          </Text>
          {isDirty ? (
            <ActionButton
              label={saveMutation.isPending ? 'Saving…' : 'Save Preferences'}
              onPress={() => saveMutation.mutate(prefs)}
              loading={saveMutation.isPending}
              disabled={saveMutation.isPending}
            />
          ) : null}
        </Surface>

        {isDirty && !saveMutation.isPending ? (
          <PressableScale onPress={() => setIsDirty(false)}>
            <Text style={styles.resetLink}>DISCARD UNSAVED CHANGES</Text>
          </PressableScale>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: 24 },
  card: { padding: 16, gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.data, fontSize: 12, fontWeight: '700' },
  note: { fontSize: 11, color: colors.mutedForeground, lineHeight: 16 },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  prefText: { flex: 1, minWidth: 0, gap: 2 },
  rowHint: {
    textTransform: 'none',
    letterSpacing: 0,
    color: colors.mutedForeground,
  },
  resetLink: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 6,
  },
});
