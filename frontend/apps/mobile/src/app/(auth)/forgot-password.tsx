import { colors } from '@stackbluff/ui-native';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { AuthChrome, authTextStyles } from '../../screens/AuthChrome';
import { ActionButton, TextField } from '../../screens/ui';

/**
 * Forgot password — port of PWA routes/forgot-password.tsx: email form →
 * success panel ("check your email") → back to sign in.
 */

const forgotSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.forgotPassword(email.trim()),
    onSuccess: () => setSuccess(true),
    onError: (err: Error) => toast.error(err.message || 'Something went wrong'),
  });

  if (success) {
    return (
      <AuthChrome>
        <View style={styles.stack}>
          <Text style={styles.headline}>Check your email</Text>
          <Text style={styles.body}>If the email exists, we've sent a password reset link.</Text>
          <ActionButton
            label="Back to Sign In"
            onPress={() => router.replace('/(auth)/login' as never)}
          />
        </View>
      </AuthChrome>
    );
  }

  return (
    <AuthChrome>
      <View style={styles.stack}>
        <TextField
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          placeholder="user@stackbluff.com"
          keyboardType="email-address"
          error={error}
          autoFocus
        />
        <ActionButton
          label={mutation.isPending ? 'Sending…' : 'Send Reset Link'}
          loading={mutation.isPending}
          onPress={() => {
            const parsed = forgotSchema.safeParse({ email: email.trim() });
            if (!parsed.success) {
              setError(parsed.error.flatten().fieldErrors.email?.[0] ?? null);
              return;
            }
            setError(null);
            mutation.mutate();
          }}
        />
        <View style={styles.center}>
          <Pressable onPress={() => router.push('/(auth)/login' as never)}>
            <Text style={authTextStyles.link}>← Back to sign in</Text>
          </Pressable>
        </View>
      </View>
    </AuthChrome>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  center: { alignItems: 'center', marginTop: 4 },
  headline: {
    color: colors.onBackground,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  body: {
    color: colors.mutedForeground,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
});
