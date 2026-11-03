import { colors, radii } from '@stackbluff/ui-native';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import {
  FlatList,
  type ListRenderItem,
  RefreshControl,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from './ui';

/**
 * Screen chrome (Task 3-b) — safe-area padded container with an optional
 * back header, plus a FlatList wrapper with accent pull-to-refresh.
 */

export function Screen({
  title,
  subtitle,
  onBack,
  headerRight,
  children,
  style,
  safeEdges = ['top'],
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  headerRight?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  safeEdges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  return (
    <SafeAreaView style={styles.safe} edges={safeEdges}>
      <View style={[styles.inner, style]}>
        {title ? (
          <ScreenHeader title={title} subtitle={subtitle} onBack={onBack} right={headerRight} />
        ) : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

export function RefreshableFlatList<T>({
  data,
  renderItem,
  keyExtractor,
  onRefresh,
  refreshing,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent,
  contentContainerStyle,
  extraData,
}: {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** FlatList list-component slots: component type or a rendered element. */
  ListHeaderComponent?: ComponentType<unknown> | ReactElement;
  ListEmptyComponent?: ComponentType<unknown> | ReactElement;
  ListFooterComponent?: ComponentType<unknown> | ReactElement;
  contentContainerStyle?: StyleProp<ViewStyle>;
  extraData?: unknown;
}) {
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      extraData={extraData}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  listCard: {
    borderRadius: radii.base,
  },
});
