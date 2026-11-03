/**
 * Dialog shell — native port of the PWA dialog backdrop + centered card
 * used by `@stackbluff/shared/components/Dialog` (LeaveTable / KickVote /
 * PlayerStats / GameDialog) and the standalone portal dialogs
 * (BuyInDialog / HistoryDialog): black/70 blurred backdrop, spring card
 * entry (damping 30, stiffness 400), optional close button.
 *
 * Rendered through an RN `Modal` so dialogs overlay the whole scene.
 */
import { type ReactNode, useEffect } from 'react';
import { Modal, type StyleProp, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { XIcon } from '../icons';

export interface DialogShellProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Card max width in px (PWA max-w-sm = 384 / max-w-2xl = 672). */
  maxWidth?: number;
  showCloseButton?: boolean;
  /** Rendered as a small pill next to the title (PWA "{total} hands"). */
  style?: StyleProp<ViewStyle>;
}

export function DialogShell({
  open,
  onClose,
  children,
  maxWidth = 384,
  showCloseButton = true,
  style,
}: DialogShellProps) {
  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.95);
  const cardY = useSharedValue(40);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (open) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      cardScale.value = withSpring(1, { damping: 30, stiffness: 400 });
      cardY.value = withSpring(0, { damping: 30, stiffness: 400 });
      cardOpacity.value = withTiming(1, { duration: 150 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      cardScale.value = withTiming(0.95, { duration: 150 });
      cardY.value = withTiming(40, { duration: 150 });
      cardOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [open, backdropOpacity, cardScale, cardY, cardOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }, { scale: cardScale.value }],
  }));

  if (!open) return null;

  return (
    <Modal
      transparent
      visible={open}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View pointerEvents="box-none" style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="auto"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
            },
            backdropStyle,
          ]}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <View
          pointerEvents="box-none"
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <Animated.View
            style={[
              {
                width: '100%',
                maxWidth,
                borderRadius: 12,
                backgroundColor: 'rgba(12,12,12,0.97)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 25 },
                shadowOpacity: 0.5,
                shadowRadius: 50,
                elevation: 24,
                overflow: 'hidden',
              },
              cardStyle,
              style,
            ]}
          >
            {showCloseButton && (
              <TouchableOpacity
                onPress={onClose}
                hitSlop={8}
                style={{ position: 'absolute', top: 18, right: 18, zIndex: 20, padding: 6 }}
                accessibilityLabel="Close"
              >
                <XIcon size={16} color="#c7c6cb" />
              </TouchableOpacity>
            )}
            {children}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

/** Shared dialog row/typography atoms (PWA dialog content patterns). */
export function DialogTitle({
  children,
  color = '#e2e2e2',
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <Text allowFontScaling={false} style={{ fontSize: 14, fontWeight: '600', color }}>
      {children}
    </Text>
  );
}

export function DialogDivider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />;
}

/** PWA footer button pair (Cancel / primary). */
export function DialogButton({
  label,
  onPress,
  variant = 'ghost',
  disabled,
  color,
}: {
  label: string;
  onPress: () => void;
  variant?: 'ghost' | 'primary' | 'danger' | 'amber';
  disabled?: boolean;
  color?: string;
}) {
  const styles: Record<string, { bg: string; border: string; text: string }> = {
    ghost: { bg: 'transparent', border: 'rgba(255,255,255,0.1)', text: '#c7c6cb' },
    primary: {
      bg: '#4edea3',
      border: '#4edea3',
      text: '#003824',
    },
    danger: { bg: 'rgba(239,68,68,0.8)', border: 'rgba(239,68,68,0.8)', text: '#ffffff' },
    amber: { bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
  };
  const s = styles[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: disabled ? 'rgba(255,255,255,0.06)' : s.border,
        backgroundColor: disabled ? 'rgba(255,255,255,0.02)' : s.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        allowFontScaling={false}
        style={{
          color: color ?? s.text,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
