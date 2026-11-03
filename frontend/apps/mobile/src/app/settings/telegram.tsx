import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { toast } from '../../lib/toast';
import { IconCheckCircle, IconSend } from '../../screens/icons';
import { Screen } from '../../screens/Screen';
import { SkeletonList } from '../../screens/ui';
import { useAuthStore } from '../../stores/authStore';

/**
 * Telegram settings — port of PWA routes/settings/telegram.tsx: Telegram
 * account linking via the bot deep link (`?start=link_<userId>`). The web
 * `window.open` becomes `Linking.openURL`.
 */

const DEFAULT_BOT_USERNAME = 'StackBluffBot';

export default function TelegramSettingsScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const user = useAuthStore((s) => s.user);
  const isTelegramUser = user?.platform === 'telegram';

  const botUsername = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME || DEFAULT_BOT_USERNAME;

  const handleLinkTelegram = () => {
    if (!user?.id) {
      toast.error('Sign in first to link Telegram');
      return;
    }
    const link = `https://t.me/${botUsername}?start=link_${user.id}`;
    void Linking.openURL(link).catch(() => toast.error('Could not open Telegram'));
    toast.info('Opening Telegram… Please follow the instructions in the bot.');
  };

  if (!guarded) {
    return (
      <Screen title="Telegram" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={2} />
      </Screen>
    );
  }

  return (
    <Screen
      title="Telegram Settings"
      subtitle="Link your account for notifications and reminders."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <ScrollView contentContainerStyle={styles.stack}>
        <Surface variant="card" radius={radii.base} style={styles.card}>
          <View style={styles.headRow}>
            <IconSend size={16} color={colors.accent} />
            <AppText variant="label">TELEGRAM ACCOUNT</AppText>
          </View>

          {isTelegramUser ? (
            <View style={styles.linkedBox}>
              <IconCheckCircle size={18} color={colors.accent} />
              <View style={styles.linkedText}>
                <AppText variant="body">Signed in with Telegram</AppText>
                <AppText variant="label" style={styles.linkedHint}>
                  Your account is linked to Telegram.
                </AppText>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.body}>
                Link your Telegram account to receive notifications, tournament reminders, and more.
              </Text>
              <PressableScale onPress={handleLinkTelegram}>
                <View style={styles.telegramBtn}>
                  <IconSend size={14} color="#ffffff" />
                  <Text style={styles.telegramLabel}>LINK TELEGRAM ACCOUNT</Text>
                </View>
              </PressableScale>
              <Text style={styles.hint}>
                You will be redirected to Telegram (@{botUsername}). Follow the instructions in the
                bot to complete linking.
              </Text>
            </>
          )}
        </Surface>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14, paddingBottom: 24 },
  card: { padding: 16, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.base,
    backgroundColor: `${colors.accent}14`,
    borderColor: `${colors.accent}33`,
    borderWidth: 1,
  },
  linkedText: { flex: 1, minWidth: 0, gap: 2 },
  linkedHint: {
    textTransform: 'none',
    letterSpacing: 0,
    color: colors.mutedForeground,
  },
  body: { fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  telegramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radii.base,
    backgroundColor: '#0088cc',
  },
  telegramLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    color: '#ffffff',
  },
  hint: { fontSize: 11, color: colors.mutedForeground, lineHeight: 16 },
});
