import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { api, type PurchaseRecord } from '../../lib/api';
import { toast } from '../../lib/toast';
import { Screen } from '../../screens/Screen';
import { EmptyState, ErrorState, Pill, SkeletonList } from '../../screens/ui';
import { restorePurchases, useEntitlementsStore } from '../../services/native';

/**
 * Payments settings — port of PWA routes/settings/payments.tsx: purchase
 * history (GET /payments/history), invoices via Linking, plus the native
 * restore-purchases flow (RevenueCat → entitlements store refresh).
 */

const STATUS_TONES: Record<PurchaseRecord['status'], 'accent' | 'warning' | 'danger' | 'neutral'> =
  {
    succeeded: 'accent',
    pending: 'warning',
    failed: 'danger',
    expired: 'neutral',
  };

export default function PaymentsSettingsScreen() {
  const router = useRouter();
  const guarded = useAuthGuard();
  const queryClient = useQueryClient();

  const {
    data: purchases,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<PurchaseRecord[]>({
    queryKey: ['purchase-history'],
    queryFn: () => api.purchaseHistory(),
    enabled: guarded,
    staleTime: 60_000,
    retry: 1,
  });

  const restoreMutation = useMutation({
    mutationFn: () => restorePurchases(),
    onSuccess: (info) => {
      if (info) {
        useEntitlementsStore.getState().setEntitlements({ lastVerifiedAt: Date.now() });
        toast.success('Purchases restored');
        void queryClient.invalidateQueries({ queryKey: ['purchase-history'] });
      } else {
        toast.error('Nothing to restore (store not configured)');
      }
    },
  });

  const openInvoice = (url: string) => {
    void Linking.openURL(url).catch(() => toast.error('Could not open the invoice'));
  };

  if (!guarded) {
    return (
      <Screen title="Payments" onBack={() => router.back()} safeEdges={['top']}>
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  return (
    <Screen
      title="Purchase History"
      subtitle="In-app purchases, receipts and invoices."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <ScrollView contentContainerStyle={styles.stack}>
        <PressableScale
          onPress={() => restoreMutation.mutate()}
          disabled={restoreMutation.isPending}
        >
          <View style={[styles.restoreBtn, restoreMutation.isPending && styles.disabled]}>
            <Text style={styles.restoreLabel}>
              {restoreMutation.isPending ? 'RESTORING…' : 'RESTORE PURCHASES'}
            </Text>
          </View>
        </PressableScale>

        {isLoading ? (
          <SkeletonList rows={3} height={92} />
        ) : error ? (
          <ErrorState message="Failed to load purchase history." onRetry={() => void refetch()} />
        ) : !purchases || purchases.length === 0 ? (
          <EmptyState
            title="No purchases yet"
            message="Visit the shop to buy chips or subscriptions."
            action={
              <PressableScale onPress={() => router.push('/(tabs)/shop' as never)}>
                <View style={styles.shopCta}>
                  <Text style={styles.shopCtaLabel}>GO TO SHOP</Text>
                </View>
              </PressableScale>
            }
          />
        ) : (
          <View style={styles.listBlock}>
            <AppText variant="label">
              {purchases.length} PURCHASE{purchases.length === 1 ? '' : 'S'}
            </AppText>
            {purchases.map((purchase) => (
              <Surface key={purchase.id} variant="card" radius={radii.base}>
                <View style={styles.purchase}>
                  <View style={styles.purchaseHead}>
                    <AppText variant="body" style={styles.purchaseName} numberOfLines={1}>
                      {purchase.product_name}
                    </AppText>
                    <Pill
                      label={purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                      tone={STATUS_TONES[purchase.status] ?? 'neutral'}
                    />
                  </View>
                  <AppText variant="label" style={styles.purchaseType}>
                    {purchase.product_type.replace(/_/g, ' ')}
                  </AppText>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {new Date(purchase.created_at).toLocaleDateString()}
                    </Text>
                    <Text style={styles.metaText}>
                      {purchase.amount} {purchase.currency}
                    </Text>
                    <Text style={styles.metaId}>ID {purchase.payment_id.slice(0, 8)}</Text>
                  </View>
                  {purchase.invoice_url ? (
                    <PressableScale onPress={() => openInvoice(purchase.invoice_url as string)}>
                      <Text style={styles.invoiceLink}>VIEW INVOICE</Text>
                    </PressableScale>
                  ) : null}
                </View>
              </Surface>
            ))}
            {isRefetching ? (
              <Text style={styles.refreshNote}>Refreshing…</Text>
            ) : (
              <PressableScale onPress={() => void refetch()}>
                <Text style={styles.refreshNote}>REFRESH</Text>
              </PressableScale>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: 24 },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabled: { opacity: 0.5 },
  restoreLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.onBackground,
  },
  listBlock: { gap: 10 },
  purchase: { padding: 14, gap: 6 },
  purchaseHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  purchaseName: { flex: 1, fontWeight: '700' },
  purchaseType: {
    textTransform: 'none',
    letterSpacing: 0.5,
    color: colors.mutedForeground,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaText: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  metaId: { fontFamily: fonts.data, fontSize: 10, color: colors.outlineVariant },
  invoiceLink: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  refreshNote: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 4,
  },
  shopCta: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
  },
  shopCtaLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.onAccent,
  },
});
