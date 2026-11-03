import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useRouter } from 'expo-router';
import type { ComponentType } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import {
  IconBell,
  IconChevronRight,
  IconCreditCard,
  IconPalette,
  type IconProps,
  IconSend,
  IconShield,
  IconUser,
  IconVolume,
} from '../../screens/icons';
import { Screen } from '../../screens/Screen';
import { SkeletonList } from '../../screens/ui';

/**
 * Settings index — port of PWA routes/settings/index.tsx: section list into
 * the seven settings sub-pages. Auth-guarded (the PWA parent route runs
 * `requireAuth` in beforeLoad).
 */

interface SettingsSection {
  key: string;
  title: string;
  description: string;
  icon: ComponentType<IconProps>;
  to: string;
}

const SECTIONS: SettingsSection[] = [
  {
    key: 'account',
    title: 'Account',
    description: 'Manage your profile, password, and email',
    icon: IconUser,
    to: '/settings/account',
  },
  {
    key: 'notifications',
    title: 'Notifications',
    description: 'Push notifications and alert preferences',
    icon: IconBell,
    to: '/settings/notifications',
  },
  {
    key: 'appearance',
    title: 'Appearance',
    description: 'Theme, felt color, and visual preferences',
    icon: IconPalette,
    to: '/settings/appearance',
  },
  {
    key: 'audio',
    title: 'Audio',
    description: 'Sound effects and haptics',
    icon: IconVolume,
    to: '/settings/audio',
  },
  {
    key: 'privacy',
    title: 'Privacy & Data',
    description: 'GDPR, data export, and account deletion',
    icon: IconShield,
    to: '/settings/privacy',
  },
  {
    key: 'payments',
    title: 'Payments',
    description: 'Purchase history and invoices',
    icon: IconCreditCard,
    to: '/settings/payments',
  },
  {
    key: 'telegram',
    title: 'Telegram',
    description: 'Link your Telegram account for notifications',
    icon: IconSend,
    to: '/settings/telegram',
  },
];

export default function SettingsIndexScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();

  if (!guarded) {
    return (
      <Screen title="Settings" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  return (
    <Screen
      title="Settings"
      subtitle="Manage your account, preferences, and platform integrations."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <PressableScale key={section.key} onPress={() => router.push(section.to as never)}>
              <Surface variant="card" radius={radii.base}>
                <View style={styles.row}>
                  <View style={styles.iconWrap}>
                    <Icon size={18} color={colors.accent} />
                  </View>
                  <View style={styles.body}>
                    <AppText variant="body" style={styles.title}>
                      {section.title}
                    </AppText>
                    <AppText variant="label" style={styles.description}>
                      {section.description}
                    </AppText>
                  </View>
                  <IconChevronRight size={16} color={colors.outline} />
                </View>
              </Surface>
            </PressableScale>
          );
        })}

        <AppText variant="label" style={styles.footerNote}>
          STACKBLUFF MOBILE · BUILD {process.env.EXPO_PUBLIC_APP_VARIANT ?? 'DEV'}
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${colors.accent}14`,
    borderColor: `${colors.accent}33`,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700' },
  description: {
    marginTop: 2,
    textTransform: 'none',
    letterSpacing: 0,
    color: colors.mutedForeground,
  },
  footerNote: {
    textAlign: 'center',
    marginTop: 16,
    fontFamily: fonts.data,
    color: colors.outlineVariant,
  },
});
