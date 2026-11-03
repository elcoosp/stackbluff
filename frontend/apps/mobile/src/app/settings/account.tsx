import { AppText, radii, Surface } from '@stackbluff/ui-native';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { Screen } from '../../screens/Screen';
import { ActionButton, SkeletonList, TextField } from '../../screens/ui';
import { useAuthStore } from '../../stores/authStore';

/**
 * Account settings — port of PWA routes/settings/account.tsx (display name +
 * password update via PATCH /user/me). The PWA's language selector depends on
 * the lingui locale bundles (.mjs dynamic imports), which have no native
 * equivalent yet — omitted here, see worklog deviation note.
 */

export default function AccountSettingsScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const user = useAuthStore((s) => s.user);
  const [displayName, setDisplayName] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: { display_name?: string; password?: string }) => api.updateProfile(data),
    onSuccess: () => {
      toast.success('Profile updated successfully!');
      setPassword('');
      setConfirmPassword('');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update profile'),
  });

  if (!guarded) {
    return (
      <Screen title="Account Settings" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  const handleSave = () => {
    const data: { display_name?: string; password?: string } = {};
    if (displayName.trim() && displayName.trim() !== user?.username) {
      data.display_name = displayName.trim();
    }
    if (password) {
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      data.password = password;
    }
    if (Object.keys(data).length === 0) {
      toast.info('No changes to save');
      return;
    }
    updateMutation.mutate(data);
  };

  return (
    <Screen
      title="Account Settings"
      subtitle={user?.email ?? user?.username ?? undefined}
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
        <Surface variant="card" radius={radii.base} style={styles.card}>
          <AppText variant="label">DISPLAY NAME</AppText>
          <TextField
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
          />
        </Surface>

        <Surface variant="card" radius={radii.base} style={styles.card}>
          <AppText variant="label">CHANGE PASSWORD</AppText>
          <TextField
            label="New Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Leave blank to keep current"
            secure
          />
          <TextField
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secure
          />
        </Surface>

        <ActionButton
          label={updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          loading={updateMutation.isPending}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14, paddingBottom: 24 },
  card: { padding: 16, gap: 10 },
});
