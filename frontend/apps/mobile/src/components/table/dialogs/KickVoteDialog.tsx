/**
 * KickVoteDialog — native port of PWA `components/game/KickVoteDialog.tsx`.
 *
 * Countdown, votes progress bar (yellow-400 fill, 0.3s width), Vote Yes /
 * Cancel footer, passed + timed-out terminal states. Listens for
 * `kickVoteUpdate` through the wsCompat shared-event bus (the RN stand-in
 * for the PWA's window CustomEvent transport).
 *
 * F-11 fix ported: state is mirrored into refs so the interval closure
 * always reads the latest values and `onTimeout` is held in a ref — the
 * effect deps stay `open / durationSecs / kickVoteId / requiredVotes`.
 */

import { fonts as FONTS } from '@stackbluff/ui-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon, UserXIcon } from '../icons';
import { onSharedEvent } from '../wsCompat';
import { DialogShell } from './DialogShell';

export interface KickVoteDialogProps {
  open: boolean;
  onClose: () => void;
  initiatorId: string;
  targetName: string;
  kickVoteId: string;
  durationSecs: number;
  requiredVotes: number;
  onVoteYes: (kickVoteId: string) => void;
  onTimeout: () => void;
}

export function KickVoteDialog({
  open,
  onClose,
  targetName,
  kickVoteId,
  durationSecs,
  requiredVotes,
  onVoteYes,
  onTimeout,
}: KickVoteDialogProps) {
  const [timeLeft, setTimeLeft] = useState(durationSecs);
  const [votes, setVotes] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [passed, setPassed] = useState(false);

  const votesRef = useRef(0);
  const hasVotedRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  });
  useEffect(() => {
    votesRef.current = votes;
  }, [votes]);
  useEffect(() => {
    hasVotedRef.current = hasVoted;
  }, [hasVoted]);

  useEffect(() => {
    if (!open) {
      setTimeLeft(durationSecs);
      setVotes(0);
      setHasVoted(false);
      setPassed(false);
      votesRef.current = 0;
      hasVotedRef.current = false;
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Fire timeout only if nobody has voted and the vote hasn't passed.
          if (!hasVotedRef.current && votesRef.current < requiredVotes) {
            onTimeoutRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const unsubscribe = onSharedEvent('kickVoteUpdate', (detail) => {
      const d = detail as { kickVoteId?: string; yesVotes?: number; passed?: boolean } | null;
      if (d?.kickVoteId === kickVoteId) {
        setVotes(d.yesVotes || 0);
        if (d.passed) {
          setPassed(true);
          setHasVoted(true);
          hasVotedRef.current = true;
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [open, durationSecs, kickVoteId, requiredVotes]);

  const handleVoteYes = () => {
    if (hasVoted) return;
    setHasVoted(true);
    setVotes((v) => v + 1);
    onVoteYes(kickVoteId);
  };

  const progress = Math.min((votes / Math.max(1, requiredVotes)) * 100, 100);
  const isTimeout = timeLeft === 0 && !passed && votes < requiredVotes;

  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withTiming(progress, { duration: 300 });
  }, [progress, barWidth]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%` as `${number}%`,
  }));

  return (
    <DialogShell open={open} onClose={onClose} showCloseButton={false}>
      <View style={{ padding: 24 }}>
        {/* Title row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <UserXIcon size={20} color="#facc15" />
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#e2e2e2' }}>Kick Vote</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ClockIcon size={16} color="#c7c6cb" />
            <Text
              style={{
                fontSize: 14,
                fontFamily: FONTS.data,
                color: timeLeft <= 5 ? '#f87171' : '#c7c6cb',
              }}
            >
              {timeLeft}s
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 14, color: '#c7c6cb', marginBottom: 16, lineHeight: 20 }}>
          Vote to remove <Text style={{ color: '#e2e2e2', fontWeight: '500' }}>{targetName}</Text>{' '}
          from the table. {requiredVotes} votes needed.
        </Text>

        {/* Votes progress */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: '#c7c6cb' }}>{votes} votes</Text>
            <Text style={{ fontSize: 12, color: '#c7c6cb' }}>{requiredVotes} needed</Text>
          </View>
          <View
            style={{
              height: 8,
              width: '100%',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <Animated.View style={[{ height: '100%', backgroundColor: '#facc15' }, barStyle]} />
          </View>
        </View>

        {passed ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CheckCircleIcon size={16} color="#4ade80" />
            <Text style={{ color: '#4ade80', fontSize: 14 }}>
              Vote passed! Player will be removed.
            </Text>
          </View>
        ) : isTimeout ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AlertTriangleIcon size={16} color="#f87171" />
            <Text style={{ color: '#f87171', fontSize: 14 }}>Vote timed out. Player stays.</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <Pressable
              onPress={handleVoteYes}
              disabled={hasVoted}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: hasVoted ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.2)',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: hasVoted ? 'rgba(255,255,255,0.3)' : '#facc15',
                }}
              >
                {hasVoted ? 'Voted ✓' : 'Vote Yes'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>
    </DialogShell>
  );
}
