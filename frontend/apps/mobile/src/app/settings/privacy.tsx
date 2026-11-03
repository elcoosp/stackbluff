import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { Screen } from '../../screens/Screen';
import { ActionButton, SkeletonList } from '../../screens/ui';
import { useAuthStore } from '../../stores/authStore';

/**
 * Privacy & Data — port of PWA routes/settings/privacy.tsx: GDPR data export
 * (GET /users/me/data — the web download becomes an in-app JSON preview +
 * toast; the backend also emails a link), account deletion
 * (DELETE /users/me with the same 30-day semantics) and the legal links.
 *
 * Deletion status: the backend has no /gdpr/status route (PWA F-4 note) —
 * the same local `{ status: 'none' }` stub is used so the page doesn't 404.
 */

interface DeletionStatus {
  status: 'none' | 'pending' | 'completed';
  requested_at?: string;
  processed_at?: string;
}

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: deletionStatus, isLoading: statusLoading } = useQuery<DeletionStatus>({
    queryKey: ['gdpr', 'status'],
    queryFn: async () => ({ status: 'none' }) as DeletionStatus,
    staleTime: 60_000,
  });

  const exportMutation = useMutation({
    mutationFn: () => api.exportData(),
    onSuccess: () => {
      // The web flow downloads a JSON blob; on native the backend emails the
      // export link, so we surface the same promise to the user.
      toast.success(
        'Data export request submitted. You will receive a download link by email within 72 hours.',
      );
      void queryClient.invalidateQueries({ queryKey: ['gdpr'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to request data export'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAccount(),
    onSuccess: () => {
      setConfirmOpen(false);
      toast.info('Deletion request submitted. Your account will be deleted in 30 days.');
      logout();
      router.replace('/(auth)/login' as never);
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to request deletion'),
  });

  if (!guarded) {
    return (
      <Screen title="Privacy & Data" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  const isPending = deletionStatus?.status === 'pending';

  return (
    <Screen
      title="Privacy & Data"
      subtitle="Manage your account data and privacy settings."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      {statusLoading ? (
        <SkeletonList rows={2} height={110} />
      ) : (
        <ScrollView contentContainerStyle={styles.stack}>
          {/* Export */}
          <Surface variant="card" radius={radii.base} style={styles.card}>
            <AppText variant="label">EXPORT YOUR DATA</AppText>
            <Text style={styles.body}>
              Request a copy of all your personal data. You'll receive a download link by email
              within 72 hours.
            </Text>
            <ActionButton
              label={exportMutation.isPending ? 'Requesting…' : 'Request Data Export'}
              variant="outline"
              onPress={() => exportMutation.mutate()}
              loading={exportMutation.isPending}
              disabled={exportMutation.isPending || isPending}
            />
            {isPending ? (
              <Text style={styles.pendingNote}>Deletion pending — export may be limited.</Text>
            ) : null}
          </Surface>

          {/* Deletion */}
          <Surface variant="card" radius={radii.base} style={[styles.card, styles.dangerCard]}>
            <AppText variant="label" style={styles.dangerTitle}>
              DELETE ACCOUNT
            </AppText>
            {isPending ? (
              <Text style={styles.body}>
                Your account deletion is pending. It will be permanently deleted in 30 days.
                Cancellation is not supported by the server yet.
              </Text>
            ) : (
              <>
                <Text style={styles.body}>
                  Permanently delete your account and all associated data. This action is
                  irreversible and cannot be undone. You will have 30 days to cancel this request.
                </Text>
                <ActionButton
                  label="Request Account Deletion"
                  variant="danger"
                  onPress={() => setConfirmOpen(true)}
                />
              </>
            )}
          </Surface>

          {/* Legal links */}
          <View style={styles.linksRow}>
            <PressableScale onPress={() => router.push('/legal/terms' as never)}>
              <Text style={styles.link}>Terms of Service</Text>
            </PressableScale>
            <Text style={styles.linkDivider}>|</Text>
            <PressableScale onPress={() => router.push('/legal/privacy' as never)}>
              <Text style={styles.link}>Privacy Policy</Text>
            </PressableScale>
            <Text style={styles.linkDivider}>|</Text>
            <PressableScale onPress={() => router.push('/responsible-gaming' as never)}>
              <Text style={styles.link}>Responsible Gaming</Text>
            </PressableScale>
          </View>
        </ScrollView>
      )}

      {/* Confirm deletion */}
      <Modal
        transparent
        animationType="fade"
        visible={confirmOpen}
        onRequestClose={() => setConfirmOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setConfirmOpen(false)}>
          <Pressable style={styles.modalCard}>
            <Surface variant="elevated" radius={radii.lg} style={styles.modalInner}>
              <AppText variant="headline">Confirm Account Deletion</AppText>
              <Text style={styles.modalBody}>
                Are you sure you want to delete your account? This will permanently remove all your
                data, including chips, statistics, and tournament history.{' '}
                <Text style={styles.dangerTitle}>This action cannot be undone.</Text>
              </Text>
              <View style={styles.modalFooter}>
                <Pressable onPress={() => setConfirmOpen(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={deleteMutation.isPending}
                  onPress={() => deleteMutation.mutate()}
                  style={[styles.deleteBtn, deleteMutation.isPending && styles.disabled]}
                >
                  <Text style={styles.deleteLabel}>
                    {deleteMutation.isPending ? 'Submitting…' : 'Yes, Delete My Account'}
                  </Text>
                </Pressable>
              </View>
            </Surface>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14, paddingBottom: 24 },
  card: { padding: 16, gap: 12 },
  dangerCard: {
    borderColor: `${colors.error}44`,
    backgroundColor: `${colors.error}0d`,
  },
  dangerTitle: { color: colors.error },
  body: { fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  pendingNote: { fontSize: 11, color: '#facc15' },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  link: {
    fontFamily: fonts.data,
    fontSize: 12,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  linkDivider: { color: colors.outlineVariant },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { width: '100%', maxWidth: 400 },
  modalInner: { padding: 20, gap: 14 },
  modalBody: { fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.base },
  cancelLabel: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  deleteBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.base,
    backgroundColor: colors.errorContainer,
  },
  deleteLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.onErrorContainer,
  },
  disabled: { opacity: 0.5 },
});
