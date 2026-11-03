import { AppText, colors, radii } from '@stackbluff/ui-native';
import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Minimal in-app toast system (Task 3-b).
 *
 * The PWA uses sonner; native has no equivalent in the dependency set, so
 * this module provides the same call shape (`toast.success(...)` /
 * `toast.error(...)` / `toast.info(...)`) as a module-level API plus a
 * `<ToastProvider>` that renders the stack. It doubles as the game
 * websocket bridge's toast sink (see providers.tsx).
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

type PushFn = (item: Omit<ToastItem, 'id'>) => void;

let pushFn: PushFn | null = null;
let seq = 0;

function emit(message: unknown, kind: ToastKind): unknown {
  const text = typeof message === 'string' ? message : String(message ?? '');
  pushFn?.({ message: text, kind });
  return message;
}

/** Sonner-shaped module API (works from mutations, stores, the ws bridge). */
export const toast = {
  success: (message: unknown, ...rest: unknown[]) => emit(message ?? rest[0], 'success'),
  error: (message: unknown, ...rest: unknown[]) => emit(message ?? rest[0], 'error'),
  info: (message: unknown, ...rest: unknown[]) => emit(message ?? rest[0], 'info'),
};

const KIND_COLORS: Record<ToastKind, string> = {
  success: colors.accent,
  error: colors.error,
  info: colors.primary,
};

const AUTO_DISMISS_MS = 3200;
const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushFn = (item) => {
      const id = ++seq;
      setItems((current) => [...current.slice(-(MAX_TOASTS - 1)), { ...item, id }]);
      setTimeout(() => {
        setItems((current) => current.filter((t) => t.id !== id));
      }, AUTO_DISMISS_MS);
    };
    return () => {
      pushFn = null;
    };
  }, []);

  return (
    <View style={styles.flex}>
      {children}
      <View pointerEvents="none" style={styles.stack}>
        {items.map((item) => (
          <View key={item.id} style={[styles.toast, { borderLeftColor: KIND_COLORS[item.kind] }]}>
            <AppText variant="label" style={{ color: KIND_COLORS[item.kind], fontSize: 10 }}>
              {item.kind.toUpperCase()}
            </AppText>
            <Text style={styles.message} numberOfLines={3}>
              {item.message}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    gap: 8,
  },
  toast: {
    backgroundColor: colors.popover,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderRadius: radii.base,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  message: {
    color: colors.popoverForeground,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
});
