import { colors } from '@stackbluff/ui-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { AuthChrome } from '../../screens/AuthChrome';
import { IconCheckCircle, IconLoader, IconXCircle } from '../../screens/icons';
import { ActionButton } from '../../screens/ui';

/**
 * Verify email — port of PWA routes/verify-email.tsx: reads ?token=…,
 * auto-verifies once, renders loading → success → error states.
 */

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    let mounted = true;
    void (async () => {
      try {
        await api.verifyEmail(token);
        if (!mounted) return;
        setStatus('success');
        toast.success('Email verified successfully!');
      } catch (error) {
        if (!mounted) return;
        setStatus('error');
        toast.error(error instanceof Error ? error.message : 'Verification failed');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <AuthChrome>
      {status === 'loading' ? (
        <View style={styles.center}>
          <IconLoader size={48} color={colors.accent} />
          <Text style={styles.headline}>Verifying…</Text>
          <Text style={styles.body}>Please wait while we verify your email.</Text>
          <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} />
        </View>
      ) : null}
      {status === 'success' ? (
        <View style={styles.center}>
          <IconCheckCircle size={48} color={colors.accent} />
          <Text style={styles.headline}>Email Verified!</Text>
          <Text style={styles.body}>
            Your email has been successfully verified. You can now access all features.
          </Text>
          <ActionButton
            label="Continue to Lobby"
            onPress={() => router.replace('/(tabs)' as never)}
          />
        </View>
      ) : null}
      {status === 'error' ? (
        <View style={styles.center}>
          <IconXCircle size={48} color={colors.error} />
          <Text style={styles.headline}>Verification Failed</Text>
          <Text style={styles.body}>
            {token
              ? 'The verification link is invalid or has expired.'
              : 'No verification token provided.'}
          </Text>
          <ActionButton
            label="Back to Sign In"
            onPress={() => router.replace('/(auth)/login' as never)}
          />
          <Text style={styles.hint}>
            If you didn't receive a verification email, you can request a new one from your account
            settings.
          </Text>
        </View>
      ) : null}
    </AuthChrome>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  headline: {
    color: colors.onBackground,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  body: {
    color: colors.mutedForeground,
    fontSize: 14,
    textAlign: 'center',
  },
  hint: {
    color: colors.mutedForeground,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
});
