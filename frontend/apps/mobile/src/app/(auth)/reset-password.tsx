import { colors } from '@stackbluff/ui-native';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { AuthChrome, authTextStyles } from '../../screens/AuthChrome';
import { ActionButton, TextField } from '../../screens/ui';

/**
 * Reset password — port of PWA routes/reset-password.tsx: ?token=<…> from
 * the deep link, password + confirm with zod refine, success panel.
 */

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.resetPassword(token, password),
    onSuccess: () => {
      setSuccess(true);
      toast.success('Password reset successfully!');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to reset password'),
  });

  if (!token) {
    return (
      <AuthChrome>
        <View style={styles.stack}>
          <Text style={styles.headline}>Invalid Reset Link</Text>
          <Text style={styles.body}>The password reset link is missing or invalid.</Text>
          <ActionButton
            label="Back to Sign In"
            onPress={() => router.replace('/(auth)/login' as never)}
          />
        </View>
      </AuthChrome>
    );
  }

  if (success) {
    return (
      <AuthChrome>
        <View style={styles.stack}>
          <Text style={styles.headline}>Password Reset Successful</Text>
          <Text style={styles.body}>
            Your password has been updated. You can now sign in with your new password.
          </Text>
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
          label="New Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secure
          error={errors.password}
        />
        <TextField
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
          secure
          error={errors.confirmPassword}
        />
        <ActionButton
          label={mutation.isPending ? 'Resetting…' : 'Reset Password'}
          loading={mutation.isPending}
          onPress={() => {
            const parsed = resetSchema.safeParse({ password, confirmPassword });
            if (!parsed.success) {
              const flat = parsed.error.flatten().fieldErrors;
              setErrors({
                password: flat.password?.[0],
                confirmPassword: flat.confirmPassword?.[0],
              });
              return;
            }
            setErrors({});
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
