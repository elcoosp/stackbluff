import { AppText, colors, fonts, radii, Surface } from '@stackbluff/ui-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Auth screen chrome (Task 3-b) — dark radial-feel backdrop, STACKBLUFF
 * wordmark, glass panel surface, keyboard-avoiding scroll body. Ports the
 * PWA auth pages' layout (GlassPanel + links footer) with RN primitives.
 */

export function AuthChrome({
  children,
  footerLinks,
}: {
  children: ReactNode;
  footerLinks?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="display" style={styles.wordmark}>
            STACKBLUFF
          </AppText>
          <Surface variant="card" radius={radii.lg} padding={20} style={styles.panel}>
            {children}
          </Surface>
          {footerLinks ? <View style={styles.footer}>{footerLinks}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthLinkRow({ children }: { children: ReactNode }) {
  return <View style={styles.linkRow}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 20,
  },
  wordmark: {
    textAlign: 'center',
    color: colors.onBackground,
    letterSpacing: -1,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.border,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
});

export const authTextStyles = StyleSheet.create({
  link: {
    fontFamily: fonts.labelCaps,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  linkAccent: { color: colors.accent },
});
