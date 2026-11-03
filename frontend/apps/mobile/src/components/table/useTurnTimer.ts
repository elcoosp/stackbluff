/**
 * Turn countdown — Reanimated shared-value port of the PWA's 250 ms
 * `setInterval` remaining-ms loops (TablePage F-20).
 *
 * A single `withTiming` drives `progress` (1 → 0, linear, duration =
 * remaining ms at arm time) and `remainingMs` on the UI thread — no rAF,
 * no setState-per-frame, no JS intervals. Level crossings (urgent ≤25%,
 * final ≤10%) fire once via `useAnimatedReaction` + `runOnJS`, feeding the
 * same `timerUrgent` / `timerFinal` feedback events the PWA triggers.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type TimerLevel = 'safe' | 'urgent' | 'final';

export interface TurnCountdown {
  /** Fraction of the window left, 1 → 0 (UI thread). */
  progress: SharedValue<number>;
  /** Milliseconds left (UI thread). */
  remainingMs: SharedValue<number>;
  /** JS-side level, updated once per crossing (not per frame). */
  level: TimerLevel;
}

function toEpochMs(expiresAt: number): number {
  // Server may send seconds or milliseconds (PWA parity: `> 1e12` check).
  return expiresAt > 1e12 ? expiresAt : expiresAt * 1000;
}

/**
 * @param expiresAt  `current_turn_expires_at` (epoch s/ms) or null
 * @param totalMs    window length (timeout_ms), fallback 30 000
 * @param onLevel    optional feedback sink for urgent/final crossings
 */
export function useTurnCountdown(
  expiresAt: number | null,
  totalMs: number | null,
  onLevel?: (level: TimerLevel) => void,
): TurnCountdown {
  const total = totalMs ?? 30000;
  const startRemaining = expiresAt ? Math.max(0, toEpochMs(expiresAt) - Date.now()) : 0;

  const progress = useSharedValue(expiresAt ? startRemaining / total : 0);
  const remainingMs = useSharedValue(expiresAt ? startRemaining : 0);
  const fired = useSharedValue(0); // bit 1 = urgent fired, bit 2 = final fired
  const [level, setLevel] = useState<TimerLevel>('safe');
  const onLevelRef = useRef(onLevel);
  useEffect(() => {
    onLevelRef.current = onLevel;
  }, [onLevel]);

  useEffect(() => {
    if (!expiresAt || total <= 0) {
      progress.value = 0;
      remainingMs.value = 0;
      fired.value = 0;
      setLevel('safe');
      return;
    }
    const rem = Math.max(0, toEpochMs(expiresAt) - Date.now());
    const clamped = Math.min(total, rem);
    fired.value = 0;
    setLevel('safe');
    progress.value = clamped / total;
    remainingMs.value = clamped;
    progress.value = withTiming(0, {
      duration: Math.max(1, clamped),
      easing: Easing.linear,
    });
    remainingMs.value = withTiming(0, {
      duration: Math.max(1, clamped),
      easing: Easing.linear,
    });
  }, [expiresAt, total, progress, remainingMs, fired]);

  const emitLevel = useCallback((next: TimerLevel) => {
    setLevel(next);
    onLevelRef.current?.(next);
  }, []);

  useAnimatedReaction(
    () => remainingMs.value / total,
    (ratio, prevRatio) => {
      const r = Math.max(0, ratio);
      const prevR = prevRatio === null ? 1 : Math.max(0, prevRatio);
      const urgentCross = r <= 0.25 && prevR > 0.25;
      const finalCross = r <= 0.1 && prevR > 0.1;
      if (finalCross && (fired.value & 2) === 0) {
        fired.value |= 2;
        runOnJS(emitLevel)('final');
      } else if (urgentCross && (fired.value & 1) === 0) {
        fired.value |= 1;
        runOnJS(emitLevel)('urgent');
      }
    },
    [total, emitLevel],
  );

  return { progress, remainingMs, level };
}
