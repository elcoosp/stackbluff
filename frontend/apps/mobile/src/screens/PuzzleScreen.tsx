import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, type PuzzleResponse } from '../lib/api';
import { toast } from '../lib/toast';
import { Screen } from '../screens/Screen';
import { EmptyState, SkeletonList } from '../screens/ui';

/**
 * Daily puzzle — port of PWA routes/puzzle.tsx: today's spot-poker puzzle,
 * possible actions, submit + explanation.
 */

export function PuzzleScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    data: puzzle,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<PuzzleResponse>({
    queryKey: ['puzzle', 'today'],
    queryFn: () => api.puzzleToday(),
    staleTime: 60_000,
    retry: 1,
  });

  const submitMutation = useMutation({
    mutationFn: (action: string) => api.submitPuzzle(action),
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.correct) toast.success('Correct! 🎉');
      else toast.error('Not quite. Try again tomorrow!');
      void queryClient.invalidateQueries({ queryKey: ['puzzle', 'today'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Submission failed'),
  });

  return (
    <Screen
      title="Daily Puzzle"
      subtitle="Find the best action and sharpen your instincts."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      {isLoading ? (
        <SkeletonList rows={3} height={80} />
      ) : error || !puzzle ? (
        <EmptyState
          title="Puzzle unavailable"
          message="Could not load today's puzzle. Please try again."
          action={
            <PressableScale onPress={() => void refetch()}>
              <View style={styles.cta}>
                <Text style={styles.ctaLabel}>{isRefetching ? 'RETRYING…' : 'RETRY'}</Text>
              </View>
            </PressableScale>
          }
        />
      ) : (
        <View style={styles.flex}>
          {/* Cards display */}
          <Surface variant="card" radius={radii.base} style={styles.situationCard}>
            <AppText variant="label">SITUATION</AppText>
            <Text style={styles.situationText}>{puzzle.action_description}</Text>
            <View style={styles.cardRow}>
              {puzzle.hole_cards.map((card, i) => (
                <PuzzleCard
                  // biome-ignore lint/suspicious/noArrayIndexKey: hole cards have no stable id
                  key={`hole-${i}`}
                  card={card}
                  hero
                />
              ))}
              <Text style={styles.vsText}>vs</Text>
              {puzzle.community_cards.map((card, i) => (
                <PuzzleCard
                  // biome-ignore lint/suspicious/noArrayIndexKey: board cards have no stable id
                  key={`board-${i}`}
                  card={card}
                />
              ))}
            </View>
          </Surface>

          {/* Actions */}
          <AppText variant="label">YOUR ACTION</AppText>
          <View style={styles.actionsWrap}>
            {puzzle.possible_actions.map((action) => (
              <PressableScale key={action} onPress={() => !submitted && setSelectedAction(action)}>
                <View
                  style={[
                    styles.actionChip,
                    selectedAction === action ? styles.actionChipActive : null,
                    submitted ? styles.actionChipSubmitted : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionChipLabel,
                      selectedAction === action ? { color: colors.onAccent } : null,
                    ]}
                  >
                    {action.toUpperCase()}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </View>

          {!submitted ? (
            <PressableScale
              onPress={() => {
                if (selectedAction) submitMutation.mutate(selectedAction);
                else toast.info('Select an action first');
              }}
              disabled={submitMutation.isPending}
            >
              <View style={[styles.submitBtn, submitMutation.isPending && styles.buttonDisabled]}>
                <Text style={styles.submitLabel}>
                  {submitMutation.isPending ? 'SUBMITTING…' : 'SUBMIT ANSWER'}
                </Text>
              </View>
            </PressableScale>
          ) : null}

          {submitted && submitMutation.data ? (
            <Surface variant="card" radius={radii.base} style={styles.explainCard}>
              <Text
                style={[
                  styles.explainTitle,
                  { color: submitMutation.data.correct ? colors.accent : colors.error },
                ]}
              >
                {submitMutation.data.correct ? 'CORRECT!' : 'INCORRECT'}
              </Text>
              <Text style={styles.explainText}>{submitMutation.data.explanation}</Text>
              <Text style={styles.explainMeta}>
                Your action: {submitMutation.data.user_action} · Best:{' '}
                {submitMutation.data.correct_action}
              </Text>
            </Surface>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

/** Mini playing-card render (rank over suit glyph). */
function PuzzleCard({ card, hero }: { card: string; hero?: boolean }) {
  const red = card.includes('♥') || card.includes('♦') || card.includes('h') || card.includes('d');
  return (
    <View style={[styles.cardFace, hero ? styles.cardFaceHero : null]}>
      <Text style={[styles.cardText, red ? styles.cardRed : null]} numberOfLines={1}>
        {card}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  situationCard: { padding: 16, gap: 10 },
  situationText: { fontFamily: fonts.body, fontSize: 14, color: colors.onBackground },
  cardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  cardFace: {
    minWidth: 44,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.base - 4,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFaceHero: { borderWidth: 2, borderColor: colors.accent },
  cardText: {
    fontFamily: fonts.data,
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  cardRed: { color: colors.suitRed },
  vsText: {
    fontFamily: fonts.data,
    fontSize: 11,
    color: colors.mutedForeground,
    paddingHorizontal: 4,
  },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainerLow,
  },
  actionChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionChipSubmitted: { opacity: 0.7 },
  actionChipLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onBackground,
  },
  submitBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
  },
  submitLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.onAccent,
  },
  buttonDisabled: { opacity: 0.5 },
  explainCard: { padding: 16, gap: 8 },
  explainTitle: { fontFamily: fonts.data, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  explainText: { fontFamily: fonts.body, fontSize: 13, color: colors.onBackground },
  explainMeta: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  cta: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.onBackground,
  },
});
