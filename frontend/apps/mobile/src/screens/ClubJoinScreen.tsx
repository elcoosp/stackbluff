import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, type ClubDetails } from '../lib/api';
import { toast } from '../lib/toast';
import { IconUsers } from '../screens/icons';
import { Screen } from '../screens/Screen';
import { EmptyState, SkeletonList } from '../screens/ui';

/**
 * Club join — port of PWA routes/clubs/join.tsx: ?invite=<code> preview →
 * join → success panel → redirect to the club page.
 */

export function ClubJoinScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ invite?: string }>();
  const invite = typeof params.invite === 'string' ? params.invite : '';
  const [joined, setJoined] = useState(false);

  const {
    data: club,
    isLoading,
    error,
  } = useQuery<ClubDetails>({
    queryKey: ['club-invite', invite],
    queryFn: () => api.clubInvitePreview(invite),
    enabled: !!invite,
    staleTime: 60_000,
    retry: 1,
  });

  const joinMutation = useMutation({
    mutationFn: () => api.joinClub(invite),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clubs'] });
      setJoined(true);
      toast.success('Successfully joined the club!');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to join club'),
  });

  useEffect(() => {
    if (!joined || !club) return;
    const t = setTimeout(() => {
      router.replace(`/clubs/${club.id}` as never);
    }, 1500);
    return () => clearTimeout(t);
  }, [joined, club, router]);

  return (
    <Screen title="Join Club" onBack={() => router.back()} safeEdges={['top']}>
      {!invite ? (
        <EmptyState
          title="No Invite Code"
          message="This page requires an invite code."
          action={
            <PressableScale onPress={() => router.replace('/(tabs)/clubs' as never)}>
              <View style={styles.cta}>
                <Text style={styles.ctaLabel}>BACK TO CLUBS</Text>
              </View>
            </PressableScale>
          }
        />
      ) : isLoading ? (
        <View style={styles.centerWrap}>
          <SkeletonList rows={2} height={72} />
          <Text style={styles.loadingNote}>Loading club details…</Text>
        </View>
      ) : error || !club ? (
        <EmptyState
          title="Invalid Invite"
          message="This invite link is invalid or has expired."
          action={
            <PressableScale onPress={() => router.replace('/(tabs)/clubs' as never)}>
              <View style={styles.cta}>
                <Text style={styles.ctaLabel}>BACK TO CLUBS</Text>
              </View>
            </PressableScale>
          }
        />
      ) : joined ? (
        <Surface variant="card" radius={radii.base} style={styles.joinedCard}>
          <Text style={styles.joinedEmoji}>🎉</Text>
          <AppText variant="headline" center>
            You're a Member!
          </AppText>
          <Text style={styles.body}>
            You have successfully joined <Text style={styles.strong}>{club.name}</Text>.
          </Text>
          <Text style={styles.redirectNote}>Redirecting to club page…</Text>
        </Surface>
      ) : (
        <Surface variant="card" radius={radii.base} style={styles.previewCard}>
          <View style={styles.clubHead}>
            <View style={styles.clubAvatar}>
              <Text style={styles.clubAvatarText}>{club.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.clubBody}>
              <AppText variant="headline">{club.name}</AppText>
              <View style={styles.memberRow}>
                <IconUsers size={12} color={colors.mutedForeground} />
                <Text style={styles.memberText}>{club.members_count} members</Text>
              </View>
              {club.is_owner ? (
                <View style={styles.ownerRow}>
                  <Text style={styles.ownerText}>You are the owner</Text>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={styles.body}>
            You've been invited to join this club. Click the button below to become a member.
          </Text>

          {club.is_owner || club.is_member ? (
            <PressableScale onPress={() => router.replace(`/clubs/${club.id}` as never)}>
              <View
                style={[styles.cta, { backgroundColor: colors.accent, borderColor: colors.accent }]}
              >
                <Text style={[styles.ctaLabel, { color: colors.onAccent }]}>VIEW CLUB</Text>
              </View>
            </PressableScale>
          ) : (
            <PressableScale onPress={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
              <View
                style={[
                  styles.cta,
                  { backgroundColor: colors.accent, borderColor: colors.accent },
                  joinMutation.isPending && styles.buttonDisabled,
                ]}
              >
                <Text style={[styles.ctaLabel, { color: colors.onAccent }]}>
                  {joinMutation.isPending ? 'JOINING…' : 'JOIN CLUB'}
                </Text>
              </View>
            </PressableScale>
          )}

          <PressableScale onPress={() => router.replace('/(tabs)/clubs' as never)}>
            <View style={styles.cta}>
              <Text style={styles.ctaLabel}>BACK TO CLUBS</Text>
            </View>
          </PressableScale>
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerWrap: { gap: 12, paddingVertical: 12 },
  loadingNote: {
    fontFamily: fonts.data,
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  joinedCard: { padding: 24, gap: 8, alignItems: 'center' },
  joinedEmoji: { fontSize: 40 },
  previewCard: { padding: 20, gap: 12 },
  clubHead: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  clubAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${colors.accent}18`,
    borderColor: `${colors.accent}55`,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubAvatarText: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
  clubBody: { flex: 1, minWidth: 0, gap: 3 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberText: { fontFamily: fonts.data, fontSize: 12, color: colors.mutedForeground },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownerText: { fontFamily: fonts.data, fontSize: 10, color: colors.accent },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedForeground },
  strong: { color: colors.onBackground, fontWeight: '700' },
  redirectNote: {
    fontFamily: fonts.data,
    fontSize: 10,
    color: colors.mutedForeground,
    opacity: 0.7,
  },
  cta: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.onBackground,
  },
  buttonDisabled: { opacity: 0.5 },
});
