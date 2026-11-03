import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { AuthChrome, AuthLinkRow, authTextStyles } from '../../screens/AuthChrome';
import { ActionButton, TextField } from '../../screens/ui';
import { useAuthStore } from '../../stores/authStore';

/**
 * Login screen — port of PWA routes/login.tsx (email flow; the Telegram
 * initData flow is web-mini-app-only and not applicable on native).
 * Validation: zod; honors ?redirectTo=<path> after success.
 */

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirectTo?: string }>();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Signed-in users don't see the auth screens (PWA beforeLoad behavior).
  useEffect(() => {
    const { user, hydrated } = useAuthStore.getState();
    if (hydrated && user) {
      router.replace('/(tabs)' as never);
    }
  }, [router]);

  const loginMutation = useMutation({
    mutationFn: () => api.login(email.trim(), password),
    onSuccess: async (data) => {
      setAuth(data.user, data.token, data.balance || 0);
      toast.success(`Welcome back, ${data.user.username}`);
      const redirectTo = params.redirectTo;
      const dest = redirectTo?.startsWith('/') ? redirectTo : '/(tabs)';
      router.replace(dest as never);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Invalid credentials');
    },
  });

  const handleSubmit = () => {
    const parsed = loginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        email: flat.email?.[0],
        password: flat.password?.[0],
      });
      return;
    }
    setFieldErrors({});
    loginMutation.mutate();
  };

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
          <Text style={[authTextStyles.link, styles.divider]}>|</Text>
          <Pressable onPress={() => router.push('/responsible-gaming' as never)}>
            <Text style={authTextStyles.link}>Responsible Gaming</Text>
          </Pressable>
        </AuthLinkRow>
      }
    >
      <View style={styles.stack}>
        <TextField
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          placeholder="user@stackbluff.com"
          keyboardType="email-address"
          error={fieldErrors.email}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secure
          error={fieldErrors.password}
        />
        <ActionButton
          label={loginMutation.isPending ? 'Authenticating…' : 'Sign In'}
          onPress={handleSubmit}
          loading={loginMutation.isPending}
        />
        <Pressable
          onPress={() => router.push('/(auth)/forgot-password' as never)}
          style={styles.center}
        >
          <Text style={authTextStyles.link}>Forgot password?</Text>
        </Pressable>
        <View style={styles.center}>
          <Pressable onPress={() => router.push('/(auth)/register' as never)}>
            <Text style={authTextStyles.link}>
              New to StackBluff? <Text style={authTextStyles.linkAccent}>Create account</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </AuthChrome>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  center: { alignItems: 'center', marginTop: 4 },
  divider: { opacity: 0.3 },
});
