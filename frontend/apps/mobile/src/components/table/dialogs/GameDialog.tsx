/**
 * GameDialog — native port of PWA `components/game/GameDialog.tsx`.
 *
 * DialogShell with an optional turn-timer strip on top: when `isMyTurn` and
 * a remaining-ms value is present, a ui-native TimerBar slides in above the
 * children. PWA: height 0 ↔ auto, 0.25s cubic-bezier(0.22,1,0.36,1); the
 * natural strip height is PWA-exact (pt-4 = 16 + h-1 bar = 4 → 20px).
 */

import { TimerBar } from '@stackbluff/ui-native';
import { type ReactNode, useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DialogShell } from './DialogShell';

export interface GameDialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  isMyTurn?: boolean;
  timerRemainingMs?: number | null;
  timerTotalMs?: number | null;
  showCloseButton?: boolean;
  /** Card max width in px (PWA `max-w-sm` = 384). */
  maxWidth?: number;
}

const TIMER_STRIP_HEIGHT = 20; // pt-4 (16) + h-1 bar (4), PWA-exact

export function GameDialog({
  open,
  onClose,
  children,
  isMyTurn = false,
  timerRemainingMs = null,
  timerTotalMs = null,
  showCloseButton = true,
  maxWidth = 384,
}: GameDialogProps) {
  const showTimer = isMyTurn && timerRemainingMs !== null;
  const height = useSharedValue(showTimer ? TIMER_STRIP_HEIGHT : 0);
  const opacity = useSharedValue(showTimer ? 1 : 0);

  useEffect(() => {
    height.value = withTiming(showTimer ? TIMER_STRIP_HEIGHT : 0, {
      duration: 250,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    opacity.value = withTiming(showTimer ? 1 : 0, {
      duration: 250,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [showTimer, height, opacity]);

  const timerStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
  }));

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      showCloseButton={showCloseButton}
      maxWidth={maxWidth}
    >
      <Animated.View
        pointerEvents={showTimer ? 'auto' : 'none'}
        style={[{ overflow: 'hidden' }, timerStyle]}
      >
        <TimerBar
          remainingMs={timerRemainingMs}
          totalMs={timerTotalMs ?? null}
          isActive
          style={{ marginTop: 16, marginHorizontal: 16 }}
        />
      </Animated.View>
      {children}
    </DialogShell>
  );
}
