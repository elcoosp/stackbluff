import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type Club } from '../lib/api';
import { useAuthGuard } from '../lib/authGuard';
import { toast } from '../lib/toast';
import { IconChevronRight, IconCrown, IconPlus, IconUsers } from '../screens/icons';
import { Screen } from '../screens/Screen';
import { EmptyState, ErrorState, SkeletonList, TextField } from '../screens/ui';

/**
 * Clubs tab — port of PWA routes/clubs/index.tsx (auth-guarded): club grid
 * with owner crown badge, invite-code join form, CreateClubModal port.
 */

export function ClubsScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const {
    data: clubs,
    isLoading,
    error,
    refetch,
  } = useQuery<Club[]>({
    queryKey: ['clubs'],
    queryFn: () => api.clubs(),
    staleTime: 60_000,
    enabled: guarded,
  });

  if (!guarded) {
    return (
      <Screen safeEdges={['top']}>
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  return (
    <Screen
      safeEdges={['top']}
      headerRight={
        <PressableScale onPress={() => setCreateOpen(true)}>
          <Surface variant="card" radius={radii.base} style={styles.createBtn}>
            <IconPlus size={14} color={colors.accent} />
            <Text style={styles.createLabel}>CREATE</Text>
          </Surface>
        </PressableScale>
      }
    >
      <View style={styles.flex}>
        <View style={styles.headerBlock}>
          <AppText variant="display">Poker Clubs</AppText>
          <AppText variant="body" style={styles.subtitle}>
            Create your private club or join an exclusive community.
          </AppText>
        </View>

        {/* Invite join form */}
        <Surface variant="card" radius={radii.base} style={styles.inviteCard}>
          <View style={styles.inviteRow}>
            <View style={styles.inviteInputWrap}>
              <TextField
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="Enter invite code"
              />
            </View>
            <PressableScale
              onPress={() => {
                const code = inviteCode.trim();
                if (code) {
                  router.push(`/clubs/join?invite=${encodeURIComponent(code)}` as never);
                } else {
                  toast.error('Please enter an invite code');
                }
              }}
            >
              <Surface variant="card" radius={radii.base} style={styles.joinBtn}>
                <IconUsers size={14} color={colors.accent} />
                <Text style={styles.joinLabel}>JOIN</Text>
              </Surface>
            </PressableScale>
          </View>
        </Surface>

        {isLoading ? (
          <SkeletonList rows={3} />
        ) : error ? (
          <ErrorState message="Failed to load clubs" onRetry={() => void refetch()} />
        ) : !clubs || clubs.length === 0 ? (
          <EmptyState
            icon={<IconUsers size={26} color={colors.mutedForeground} />}
            title="No clubs yet"
            message="You haven't joined any clubs yet. Create a club or join one with an invite."
            action={
              <PressableScale onPress={() => setCreateOpen(true)}>
                <Surface variant="card" radius={radii.base} style={styles.firstClubCta}>
                  <IconPlus size={14} color={colors.onAccent} />
                  <Text style={styles.firstClubCtaLabel}>Create Your First Club</Text>
                </Surface>
              </PressableScale>
            }
          />
        ) : (
          <View style={styles.clubGrid}>
            {clubs.map((club) => (
              <PressableScale
                key={club.id}
                onPress={() => router.push(`/clubs/${club.id}` as never)}
              >
                <Surface variant="card" radius={radii.base}>
                  <View style={styles.clubRow}>
                    <View style={styles.clubAvatar}>
                      <Text style={styles.clubAvatarText}>{club.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.clubBody}>
                      <View style={styles.clubNameRow}>
                        <AppText variant="body" style={styles.clubName} numberOfLines={1}>
                          {club.name}
                        </AppText>
                        {club.is_owner ? (
                          <View style={styles.ownerBadge}>
                            <IconCrown size={10} color={colors.accent} />
                            <Text style={styles.ownerBadgeLabel}>OWNER</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.clubMetaRow}>
                        <IconUsers size={11} color={colors.mutedForeground} />
                        <Text style={styles.clubMeta}>{club.members_count} members</Text>
                      </View>
                    </View>
                    <IconChevronRight size={16} color={colors.outline} />
                  </View>
                </Surface>
              </PressableScale>
            ))}
          </View>
        )}
      </View>

      <CreateClubModal
        visible={createOpen}
        onClose={() => {
          setCreateOpen(false);
          void queryClient.invalidateQueries({ queryKey: ['clubs'] });
        }}
      />
    </Screen>
  );
}

/* ── Create club modal (CreateClubModal port) ───────────────────────────── */

function CreateClubModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [telegramGroupId, setTelegramGroupId] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => api.createClub(name.trim(), telegramGroupId.trim() || undefined),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['clubs'] });
      onClose();
      toast.success('Club created!');
      router.push(`/clubs/${data.club_id}` as never);
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create club'),
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard}>
          <Surface variant="elevated" radius={radii.lg} style={styles.modalInner}>
            <AppText variant="headline">Create New Club</AppText>
            <AppText variant="label" style={styles.modalSubtitle}>
              Name your club and (optionally) link a Telegram group.
            </AppText>

            <TextField
              label="Club Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g., Midnight Crew"
              error={nameError}
            />
            <TextField
              label="Telegram Group ID (optional)"
              value={telegramGroupId}
              onChangeText={setTelegramGroupId}
              placeholder="-1001234567890"
            />

            <View style={styles.modalFooter}>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={createMutation.isPending || !name.trim()}
                onPress={() => {
                  if (!name.trim()) {
                    setNameError('Club name is required');
                    return;
                  }
                  setNameError(null);
                  createMutation.mutate();
                }}
                style={[
                  styles.modalCreateBtn,
                  (createMutation.isPending || !name.trim()) && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.modalCreateLabel}>
                  {createMutation.isPending ? 'Creating…' : 'Create Club'}
                </Text>
              </Pressable>
            </View>
          </Surface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  headerBlock: { gap: 4 },
  subtitle: { color: colors.mutedForeground },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  createLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.accent,
  },
  inviteCard: { padding: 12 },
  inviteRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  inviteInputWrap: { flex: 1 },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  joinLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.accent,
  },
  clubGrid: { gap: 10, paddingBottom: 8 },
  clubRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  clubAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerHigh,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubAvatarText: {
    color: colors.onBackground,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
  clubBody: { flex: 1, minWidth: 0 },
  clubNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clubName: { fontWeight: '700' },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: `${colors.accent}18`,
    borderColor: `${colors.accent}55`,
    borderWidth: 1,
  },
  ownerBadgeLabel: {
    fontFamily: fonts.data,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.accent,
  },
  clubMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  clubMeta: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  firstClubCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  firstClubCtaLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.onAccent,
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { width: '100%', maxWidth: 400 },
  modalInner: { padding: 20, gap: 12 },
  modalSubtitle: { textTransform: 'none', letterSpacing: 0 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.base },
  cancelLabel: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  modalCreateBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
  },
  modalCreateLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onAccent,
    textTransform: 'uppercase',
  },
  buttonDisabled: { opacity: 0.5 },
});
