import { colors, fonts } from '@stackbluff/ui-native';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { AuthChrome, AuthLinkRow, authTextStyles } from '../../screens/AuthChrome';
import { ActionButton, TextField } from '../../screens/ui';
import { useAuthStore } from '../../stores/authStore';

/**
 * Register screen — port of PWA routes/register.tsx: 3-step wizard
 * (username → email → password), per-step zod validation, progress bars.
 */

const step1Schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
});
const step2Schema = z.object({ email: z.string().email('Invalid email address') });
const step3Schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const STEP_HINTS = ['choose a username', 'add your email', 'set a password'] as const;

export default function RegisterScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const mutation = useMutation({
    mutationFn: () => api.register(username.trim(), email.trim(), password),
    onSuccess: (data) => {
      setAuth(data.user, data.token, data.balance || 0);
      toast.success(`Welcome to StackBluff, ${data.user.username}`);
      router.replace('/(tabs)' as never);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Registration failed');
    },
  });

  const validateStep = (): boolean => {
    if (step === 1) {
      const parsed = step1Schema.safeParse({ username: username.trim() });
      if (!parsed.success) {
        setFieldErrors({ username: parsed.error.flatten().fieldErrors.username?.[0] });
        return false;
      }
      return true;
    }
    if (step === 2) {
      const parsed = step2Schema.safeParse({ email: email.trim() });
      if (!parsed.success) {
        setFieldErrors({ email: parsed.error.flatten().fieldErrors.email?.[0] });
        return false;
      }
      return true;
    }
    const parsed = step3Schema.safeParse({ password });
    if (!parsed.success) {
      setFieldErrors({ password: parsed.error.flatten().fieldErrors.password?.[0] });
      return false;
    }
    return true;
  };

  const nextStep = () => {
    setFieldErrors({});
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, 3));
  };

  const prevStep = () => {
    setFieldErrors({});
    setStep((s) => Math.max(s - 1, 1));
  };

  const canContinue =
    step === 1
      ? step1Schema.safeParse({ username: username.trim() }).success
      : step === 2
        ? step2Schema.safeParse({ email: email.trim() }).success
        : step3Schema.safeParse({ password }).success;

  return (
    <AuthChrome
      footerLinks={
        <AuthLinkRow>
          <Pressable onPress={() => router.push('/legal/terms' as never)}>
            <Text style={authTextStyles.link}>Terms of Service</Text>
          </Pressable>
          <Text style={[authTextStyles.link, styles.divider]}>|</Text>
          <Pressable onPress={() => router.push('/legal/privacy' as never)}>
            <Text style={authTextStyles.link}>Privacy Policy</Text>
          </Pressable>
        </AuthLinkRow>
      }
    >
      <View style={styles.progressRow}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.progressBar, i <= step ? styles.progressOn : null]} />
        ))}
      </View>

      <View style={styles.stack}>
        {step === 1 ? (
          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="PLAYER_01"
            error={fieldErrors.username}
            autoFocus
          />
        ) : null}
        {step === 2 ? (
          <TextField
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="user@stackbluff.com"
            keyboardType="email-address"
            error={fieldErrors.email}
            autoFocus
          />
        ) : null}
        {step === 3 ? (
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secure
            error={fieldErrors.password}
            autoFocus
          />
        ) : null}

        <View style={[styles.row, step > 1 ? styles.rowSpaced : styles.rowEnd]}>
          {step > 1 ? (
            <ActionButton label="Back" variant="outline" onPress={prevStep} style={styles.flex1} />
          ) : null}
          {step < 3 ? (
            <ActionButton
              label="Continue"
              onPress={nextStep}
              disabled={!canContinue}
              style={step > 1 ? styles.flex1 : undefined}
            />
          ) : (
            <ActionButton
              label={mutation.isPending ? 'Initializing…' : 'Create Account'}
              onPress={() => {
                if (validateStep()) mutation.mutate();
              }}
              loading={mutation.isPending}
              disabled={!canContinue}
              style={styles.flex1}
            />
          )}
        </View>

        <View style={styles.center}>
          <Pressable onPress={() => router.push('/(auth)/login' as never)}>
            <Text style={authTextStyles.link}>
              Already have an account? <Text style={authTextStyles.linkAccent}>Sign in</Text>
            </Text>
          </Pressable>
        </View>

        <Text style={styles.stepHint}>
          Step {step} of 3 — {STEP_HINTS[step - 1]}
        </Text>
      </View>
    </AuthChrome>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', gap: 6 },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
  },
  progressOn: { backgroundColor: colors.accent },
  stack: { gap: 8 },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  rowSpaced: { justifyContent: 'space-between' },
  rowEnd: { justifyContent: 'flex-end' },
  flex1: { flex: 1 },
  center: { alignItems: 'center', marginTop: 8 },
  divider: { opacity: 0.3 },
  stepHint: {
    fontFamily: fonts.data,
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
