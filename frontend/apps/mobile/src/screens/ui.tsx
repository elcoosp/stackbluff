import {
  AppText,
  colors,
  fontSizes,
  fonts,
  PressableScale,
  radii,
  Surface,
} from '@stackbluff/ui-native';
import { type ReactNode, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { IconChevronLeft } from './icons';

/**
 * Shared screen primitives (Task 3-b).
 *
 * Thin RN building blocks used by every A5 screen: labeled text fields,
 * token-driven buttons, toggles, segmented tabs, list rows, empty/error
 * states, skeleton rows and a screen chrome with an optional back header.
 * Colors come exclusively from @stackbluff/ui-native tokens.
 */

/* ── TextField ──────────────────────────────────────────────────────────── */

export interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secure?: boolean;
  error?: string | null;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  error,
  autoCapitalize = 'none',
  keyboardType = 'default',
  multiline,
  style,
  autoFocus,
}: TextFieldProps) {
  return (
    <View style={[styles.fieldWrap, style]}>
      {label ? (
        <AppText variant="label" style={styles.fieldLabel}>
          {label.toUpperCase()}
        </AppText>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={`${colors.mutedForeground}80`}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoCorrect={false}
        multiline={multiline}
        autoFocus={autoFocus}
        style={[styles.input, error ? styles.inputError : null, multiline && styles.inputMultiline]}
      />
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : (
        <View style={styles.fieldErrorSpace} />
      )}
    </View>
  );
}

/* ── Buttons ────────────────────────────────────────────────────────────── */

export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  caps?: boolean;
}

export function ActionButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
  caps = true,
}: ActionButtonProps) {
  const palette = BUTTON_VARIANTS[variant];
  return (
    <PressableScale onPress={onPress} disabled={disabled || loading} style={styles.buttonOuter}>
      <View
        style={[
          styles.button,
          { backgroundColor: palette.bg, borderColor: palette.border },
          (disabled || loading) && styles.buttonDisabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : (
          <Text
            style={[
              styles.buttonLabel,
              { color: palette.fg, fontFamily: palette.font },
              !caps && { textTransform: 'none' },
            ]}
          >
            {caps ? label.toUpperCase() : label}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const BUTTON_VARIANTS = {
  primary: { bg: colors.accent, border: colors.accent, fg: colors.onAccent, font: fonts.data },
  outline: {
    bg: 'transparent',
    border: colors.border,
    fg: colors.onBackground,
    font: fonts.data,
  },
  ghost: {
    bg: 'transparent',
    border: 'transparent',
    fg: colors.mutedForeground,
    font: fonts.data,
  },
  danger: {
    bg: colors.errorContainer,
    border: colors.error,
    fg: colors.onErrorContainer,
    font: fonts.data,
  },
} as const;

/* ── Toggle ─────────────────────────────────────────────────────────────── */

export function Toggle({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const translate = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(translate, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [value, translate]);

  return (
    <PressableScale
      onPress={() => !disabled && onValueChange(!value)}
      style={[
        styles.toggleTrack,
        { backgroundColor: value ? colors.accent : colors.surfaceContainerHighest },
      ]}
    >
      <Animated.View
        style={[
          styles.toggleThumb,
          {
            transform: [
              {
                translateX: translate.interpolate({
                  inputRange: [0, 1],
                  outputRange: [2, 22],
                }),
              },
            ],
          },
        ]}
      />
    </PressableScale>
  );
}

/* ── Segmented tabs ─────────────────────────────────────────────────────── */

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmentWrap, style]}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <PressableScale
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: active ? colors.onBackground : colors.mutedForeground },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/* ── List row ───────────────────────────────────────────────────────────── */

export function ListRow({
  title,
  subtitle,
  icon,
  right,
  onPress,
  destructive,
  style,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <View style={[styles.row, style]}>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowBody}>
        <AppText variant="body" style={{ color: destructive ? colors.error : colors.onBackground }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="label" style={styles.rowSubtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? null}
    </View>
  );
  if (!onPress)
    return (
      <Surface variant="card" radius={radii.base}>
        {body}
      </Surface>
    );
  return (
    <Surface variant="card" radius={radii.base}>
      <PressableScale onPress={onPress}>{body}</PressableScale>
    </Surface>
  );
}

/* ── States ─────────────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.stateWrap}>
      {icon ? <View style={styles.stateIcon}>{icon}</View> : null}
      <AppText variant="headline" center>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" center style={styles.stateMessage}>
          {message}
        </AppText>
      ) : null}
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = 'Retry',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <EmptyState
      title="Something went wrong"
      message={message}
      action={onRetry ? <ActionButton label={retryLabel} onPress={onRetry} /> : undefined}
    />
  );
}

/** Loading skeleton block — pulse animation, token colors. */
export function SkeletonRow({
  height = 64,
  style,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.skeleton, { height, opacity }, style]} />;
}

export function SkeletonList({ rows = 4, height = 72 }: { rows?: number; height?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
          key={i}
          height={height}
        />
      ))}
    </View>
  );
}

/* ── Data bits ──────────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Surface variant="card" radius={radii.base} style={styles.statTile}>
      <Text
        style={[styles.statValue, { color: accent ? colors.accent : colors.onBackground }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <AppText variant="label" style={styles.statLabel}>
        {label.toUpperCase()}
      </AppText>
    </Surface>
  );
}

export function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <AppText variant="body" style={styles.kvLabel}>
        {label}
      </AppText>
      <Text style={styles.kvValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function ProgressBar({ percentage, height = 6 }: { percentage: number; height?: number }) {
  const clamped = Math.max(0, Math.min(percentage, 100));
  return (
    <View style={[styles.progressTrack, { height }]}>
      <View style={[styles.progressFill, { width: `${clamped}%` }]} />
    </View>
  );
}

/** Small pill chip (badge-ish). */
export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'danger' | 'warning';
}) {
  const palette = PILL_TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.pillLabel, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const PILL_TONES = {
  neutral: { bg: `${colors.primary}20`, border: colors.border, fg: colors.mutedForeground },
  accent: { bg: `${colors.accent}18`, border: `${colors.accent}55`, fg: colors.accent },
  danger: { bg: `${colors.error}20`, border: `${colors.error}55`, fg: colors.error },
  warning: { bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.4)', fg: '#facc15' },
} as const;

/* ── Screen chrome ──────────────────────────────────────────────────────── */

export function ScreenHeader({
  title,
  onBack,
  right,
  subtitle,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <PressableScale onPress={onBack} style={styles.headerBack}>
          <IconChevronLeft size={22} />
        </PressableScale>
      ) : null}
      <View style={styles.headerTitles}>
        <AppText variant="headline" style={styles.headerTitle} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="label" style={styles.headerSubtitle} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? null}
    </View>
  );
}

export function SectionTitle({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <AppText variant="label" style={[styles.sectionTitle, style]}>
      {String(children).toUpperCase()}
    </AppText>
  );
}

/** Modal sheet (centered card) for create-table / create-club / confirm flows. */
export function ModalSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!visible) return null;
  return (
    <View style={styles.modalOverlay}>
      <PressableScale onPress={onClose} style={StyleSheet.absoluteFill}>
        <View style={StyleSheet.absoluteFill} />
      </PressableScale>
      <Surface variant="elevated" radius={radii.lg} style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <AppText variant="headline">{title}</AppText>
            {subtitle ? (
              <AppText variant="label" style={{ marginTop: 2 }}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </View>
        <View style={styles.modalBody}>{children}</View>
        {footer ? <View style={styles.modalFooter}>{footer}</View> : null}
      </Surface>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 10 },
  input: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.base,
    color: colors.onBackground,
    fontFamily: fonts.body,
    fontSize: fontSizes.body,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: colors.error },
  fieldError: {
    color: colors.error,
    fontFamily: fonts.data,
    fontSize: 12,
    minHeight: 18,
  },
  fieldErrorSpace: { minHeight: 18 },
  buttonOuter: { alignSelf: 'stretch' },
  button: {
    borderRadius: radii.base,
    borderWidth: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonLabel: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  toggleTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.onBackground,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.base,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radii.base - 4,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.surfaceContainerHigh },
  segmentLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.accent}14`,
    borderColor: `${colors.accent}33`,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowSubtitle: { marginTop: 2, textTransform: 'none', letterSpacing: 0 },
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceContainerHigh,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stateMessage: { color: colors.mutedForeground },
  stateAction: { marginTop: 12, alignSelf: 'stretch' },
  skeleton: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.base,
  },
  statTile: { padding: 16, flex: 1, minWidth: '45%' },
  statValue: {
    fontFamily: fonts.data,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: { marginTop: 4 },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  kvLabel: { color: colors.mutedForeground },
  kvValue: {
    color: colors.onBackground,
    fontFamily: fonts.data,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  progressTrack: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pillLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: 1,
  },
  headerTitles: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 20 },
  headerSubtitle: { marginTop: 1, textTransform: 'none', letterSpacing: 0.5 },
  sectionTitle: { marginBottom: 8 },
  modalOverlay: {
    // RN 0.88 dropped StyleSheet.absoluteFillObject from the TS exports —
    // spell the four fields out (same values).
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  },
  modalCard: { width: '100%', maxWidth: 420 },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
  },
  modalBody: { paddingHorizontal: 20, gap: 16 },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 20,
  },
});
