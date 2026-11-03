import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type ShopProduct } from '../lib/api';
import { PRODUCT_CHIP_GRANTS, useEntitlements } from '../lib/entitlements';
import { toast } from '../lib/toast';
import { IconShoppingBag, IconZap } from '../screens/icons';
import { Screen } from '../screens/Screen';
import { EmptyState, ErrorState, Pill, SkeletonList } from '../screens/ui';
import { purchaseProduct, restorePurchases } from '../services/native';

/**
 * Shop tab — port of PWA pages/ShopPage.tsx adapted to the RevenueCat IAP
 * flow (Agent-06 services): category tabs, product cards, purchase confirm
 * sheet, restore purchases, entitlement summary. The Stripe/Telegram-Stars
 * checkout note is web-only and hidden on native.
 */

type Category = 'all' | 'chips' | 'season_pass' | 'club_pro';

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'All Products',
  chips: 'Chips',
  season_pass: 'Season Pass',
  club_pro: 'Club Pro',
};

export function ShopScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const entitlements = useEntitlements();
  const [category, setCategory] = useState<Category>('all');
  const [selected, setSelected] = useState<(ShopProduct & { displayDescription: string }) | null>(
    null,
  );
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const {
    data: products,
    isLoading,
    error,
    refetch,
  } = useQuery<ShopProduct[]>({
    queryKey: ['shop', 'products'],
    queryFn: () => api.shopProducts(),
    staleTime: 60_000,
    retry: 2,
  });

  const transformed = useMemo(() => {
    if (!products) return [];
    return products.map((p) => ({
      ...p,
      displayDescription:
        p.product_type === 'chips'
          ? `${(p.chips_amount ?? 0).toLocaleString()} Chips`
          : p.product_type === 'season_pass'
            ? `${p.duration_days ?? 30} days of unlimited Oracle access`
            : p.description,
    }));
  }, [products]);

  const filtered =
    category === 'all' ? transformed : transformed.filter((p) => p.product_type === category);

  const handlePurchase = useMutation({
    mutationFn: async (product: ShopProduct & { displayDescription: string }) => {
      setPurchasing(true);
      return purchaseProduct(product.id);
    },
    onSuccess: (outcome) => {
      setPurchasing(false);
      setSelected(null);
      if (outcome.status === 'completed') {
        const chips = PRODUCT_CHIP_GRANTS[outcome.productId] ?? outcome.verify?.chips_awarded ?? 0;
        toast.success(
          chips > 0
            ? `Purchase complete — +${chips.toLocaleString()} chips!`
            : 'Purchase complete!',
        );
        void queryClient.invalidateQueries({ queryKey: ['shop', 'products'] });
      } else if (outcome.status === 'cancelled') {
        toast.info('Purchase cancelled');
      } else {
        toast.error(outcome.message);
      }
    },
    onError: () => {
      setPurchasing(false);
      toast.error('Purchase failed');
    },
  });

  const handleRestore = async () => {
    setRestoring(true);
    const info = await restorePurchases();
    setRestoring(false);
    if (info) toast.success('Purchases restored');
    else toast.error('Nothing to restore (store not configured)');
  };

  return (
    <Screen safeEdges={['top']}>
      <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
        <View style={styles.headerBlock}>
          <AppText variant="display">Shop</AppText>
          <AppText variant="body" style={styles.subtitle}>
            Power up your game with premium chips, passes, and exclusive features.
          </AppText>
          <View style={styles.trustRow}>
            <IconShoppingBag size={12} color={colors.accent} />
            <Text style={styles.trustText}>Secure in-app payments</Text>
            <IconZap size={12} color={colors.accent} />
            <Text style={styles.trustText}>Instant delivery</Text>
          </View>
        </View>

        {/* Entitlements summary */}
        <Surface variant="card" radius={radii.base} style={styles.entitlementCard}>
          <EntitlementFlag label="Season Pass" active={entitlements.isSeasonPass} />
          <EntitlementFlag label="Club Pro" active={entitlements.isClubPro} />
          <View style={styles.chipBalance}>
            <Text style={styles.chipBalanceValue}>
              {(entitlements.chips ?? 0).toLocaleString()}
            </Text>
            <Text style={styles.chipBalanceLabel}>CHIPS</Text>
          </View>
        </Surface>

        {/* Category tabs */}
        <View style={styles.categoryRow}>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
            <PressableScale key={cat} onPress={() => setCategory(cat)}>
              <View
                style={[styles.categoryChip, category === cat ? styles.categoryChipActive : null]}
              >
                <Text
                  style={[
                    styles.categoryLabel,
                    category === cat ? { color: colors.onAccent } : null,
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </Text>
              </View>
            </PressableScale>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.gridPad}>
            <SkeletonList rows={3} height={110} />
          </View>
        ) : error ? (
          <ErrorState message="Failed to load products" onRetry={() => void refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconShoppingBag size={26} color={colors.mutedForeground} />}
            title="Shop is empty"
            message="No products available in this category."
          />
        ) : (
          <View style={styles.gridPad}>
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPurchase={() => setSelected(product)}
              />
            ))}
            <PressableScale onPress={() => void handleRestore()}>
              <Text style={styles.restoreLink}>
                {restoring ? 'Restoring…' : 'Restore purchases'}
              </Text>
            </PressableScale>
          </View>
        )}
      </View>

      {/* Purchase confirm sheet */}
      <Modal
        transparent
        animationType="fade"
        visible={selected !== null}
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard}>
            <Surface variant="elevated" radius={radii.lg} style={styles.modalInner}>
              <AppText variant="headline">Confirm Purchase</AppText>
              {selected ? (
                <>
                  <AppText variant="label" style={styles.modalSubtitle}>
                    {selected.name}
                  </AppText>
                  <View style={styles.kvBlock}>
                    <View style={styles.kvRow}>
                      <Text style={styles.kvLabel}>Price</Text>
                      <Text style={styles.kvValue}>${selected.price_eur.toFixed(2)}</Text>
                    </View>
                    <View style={styles.kvRow}>
                      <Text style={styles.kvLabel}>Grant</Text>
                      <Text style={styles.kvValue}>{selected.displayDescription}</Text>
                    </View>
                  </View>
                  <Text style={styles.storeNote}>
                    Charged through the{' '}
                    {selected.product_type === 'chips' ? 'App Store / Play Store' : 'store'} via
                    RevenueCat. Chips are credited after server verification.
                  </Text>
                </>
              ) : null}
              <View style={styles.modalFooter}>
                <Pressable onPress={() => setSelected(null)} style={styles.cancelBtn}>
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={purchasing}
                  onPress={() => selected && handlePurchase.mutate(selected)}
                  style={[styles.createBtn, purchasing && styles.buttonDisabled]}
                >
                  {purchasing ? (
                    <ActivityIndicator size="small" color={colors.onAccent} />
                  ) : (
                    <Text style={styles.createLabel}>Purchase</Text>
                  )}
                </Pressable>
              </View>
            </Surface>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function EntitlementFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={styles.flagRow}>
      <AppText variant="label" style={styles.flagLabel}>
        {label.toUpperCase()}
      </AppText>
      <Pill label={active ? 'Active' : 'Inactive'} tone={active ? 'accent' : 'neutral'} />
    </View>
  );
}

function ProductCard({
  product,
  onPurchase,
}: {
  product: ShopProduct & { displayDescription: string };
  onPurchase: () => void;
}) {
  const tone = product.product_type === 'chips' ? 'accent' : 'warning';
  const typeLabel =
    product.product_type === 'chips'
      ? 'Chips'
      : product.product_type === 'season_pass'
        ? 'Season Pass'
        : 'Club Pro';
  return (
    <Surface variant="card" radius={radii.base}>
      <View style={styles.productBody}>
        <View style={styles.productHead}>
          <Pill label={typeLabel} tone={tone as 'accent' | 'warning'} />
          <Text style={styles.price}>${product.price_eur.toFixed(2)}</Text>
        </View>
        <AppText variant="body" style={styles.productName}>
          {product.name}
        </AppText>
        <AppText variant="label" style={styles.productDesc}>
          {product.displayDescription}
        </AppText>
        <PressableScale onPress={onPurchase}>
          <View style={styles.buyNowBtn}>
            <Text style={styles.buyNowLabel}>PURCHASE</Text>
          </View>
        </PressableScale>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  headerBlock: { gap: 4 },
  subtitle: { color: colors.mutedForeground },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  trustText: {
    fontFamily: fonts.labelCaps,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },
  entitlementCard: { padding: 14, gap: 8 },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flagLabel: { fontSize: 10 },
  chipBalance: { alignItems: 'flex-end' },
  chipBalanceValue: {
    fontFamily: fonts.data,
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
  },
  chipBalanceLabel: {
    fontFamily: fonts.labelCaps,
    fontSize: 8,
    letterSpacing: 2,
    color: colors.mutedForeground,
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainerLow,
  },
  categoryChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  categoryLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  gridPad: { gap: 12, paddingBottom: 16 },
  productBody: { padding: 14, gap: 8 },
  productHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontFamily: fonts.data, fontSize: 16, fontWeight: '700', color: colors.onBackground },
  productName: { fontWeight: '700' },
  productDesc: { textTransform: 'none', letterSpacing: 0 },
  buyNowBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
    marginTop: 2,
  },
  buyNowLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.onAccent,
  },
  restoreLink: {
    fontFamily: fonts.data,
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { width: '100%', maxWidth: 400 },
  modalInner: { padding: 20, gap: 12 },
  modalSubtitle: { textTransform: 'none', letterSpacing: 0 },
  kvBlock: { gap: 2 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between' },
  kvLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedForeground },
  kvValue: {
    fontFamily: fonts.data,
    fontSize: 13,
    color: colors.onBackground,
    fontWeight: '700',
    flexShrink: 1,
  },
  storeNote: { fontSize: 11, color: colors.mutedForeground, opacity: 0.8 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.base },
  cancelLabel: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  createBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
    minWidth: 110,
    alignItems: 'center',
  },
  createLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onAccent,
    textTransform: 'uppercase',
  },
  buttonDisabled: { opacity: 0.5 },
});
