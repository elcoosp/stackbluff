import { useCallback, useEffect } from 'react';
import { useShopProducts } from '../hooks/useShopProducts';
import { useUserProfile } from '../hooks/useUserProfile';
import { usePurchaseFlow } from '../hooks/usePurchaseFlow';
import { useShopStore } from '../stores/shopStore';
import { ProductCard } from '../components/shop/ProductCard';
import { PurchaseDialog } from '../components/shop/PurchaseDialog';
import { PurchaseToast } from '../components/shop/PurchaseToast';

export default function ShopPage() {
  const shop = useShopStore();
  const { data: productsData, isLoading: productsLoading } = useShopProducts();
  const { isLoading: userLoading } = useUserProfile();
  const { confirmPurchase, stopPolling } = usePurchaseFlow();

  useEffect(() => {
    if (productsData?.products) {
      shop.setProducts(
        productsData.products.map((p) => ({
          id: p.id,
          name: p.name,
          description:
            p.type === 'chips'
              ? `${p.chips_amount?.toLocaleString() ?? '0'} Chips`
              : p.type === 'season_pass'
              ? '8 weeks of unlimited Oracle access'
              : 'Unlock club customization features',
          priceEur: p.price_eur,
          priceStars: p.price_stars,
          type: p.type,
          chipsAmount: p.chips_amount,
          durationDays: p.duration_days,
        }))
      );
    }
  }, [productsData, shop]);

  const handlePurchase = useCallback(
    (product: any) => {
      shop.selectProduct(product);
      shop.setDialogOpen(true);
      shop.setError(null);
    },
    [shop]
  );

  const isLoading = productsLoading || userLoading;
  const products = shop.products;

  if (isLoading && products.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-lg text-slate-400">Loading shop...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold text-white md:text-4xl">Shop</h1>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onPurchase={handlePurchase} />
          ))}
        </div>
      </div>

      <PurchaseDialog onConfirm={confirmPurchase} />
      <PurchaseToast />
    </div>
  );
}
