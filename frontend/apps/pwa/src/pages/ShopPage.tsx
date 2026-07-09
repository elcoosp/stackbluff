import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShopProducts } from '../hooks/useShopProducts';
import { usePurchaseFlow } from '../hooks/usePurchaseFlow';
import { useShopStore } from '../stores/shopStore';
import { ProductCard } from '../components/shop/ProductCard';
import { PurchaseDialog } from '../components/shop/PurchaseDialog';
import { PurchaseToast } from '../components/shop/PurchaseToast';
import { cn } from '@/lib/utils';

type Category = 'all' | 'chips' | 'season_pass' | 'club_pro';

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'All Products',
  chips: 'Chips',
  season_pass: 'Season Pass',
  club_pro: 'Club Pro',
};

export default function ShopPage() {
  const shop = useShopStore();
  const { data: productsData, isLoading: productsLoading } = useShopProducts();
  const { confirmPurchase, stopPolling, isProcessing } = usePurchaseFlow();
  const [category, setCategory] = useState<Category>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Compute transformed products
  const transformedProducts = useMemo(() => {
    if (!productsData) return [];
    return productsData.map((p) => ({
      id: p.id,
      name: p.name,
      description:
        p.product_type === 'chips'
          ? `${p.chips_amount?.toLocaleString() ?? '0'} Chips`
          : p.product_type === 'season_pass'
            ? `${p.duration_days ?? 30} days of unlimited Oracle access`
            : p.description,
      priceEur: p.price_eur,
      priceStars: p.price_stars,
      type: p.product_type,
      chipsAmount: p.chips_amount,
      durationDays: p.duration_days,
    }));
  }, [productsData]);

  // Sync local products with store (only once)
  useEffect(() => {
    if (transformedProducts.length === 0) return;
    const currentIds = shop.products.map(p => p.id).sort().join(',');
    const newIds = transformedProducts.map(p => p.id).sort().join(',');
    if (currentIds !== newIds) {
      shop.setProducts(transformedProducts);
    }
  }, [transformedProducts, shop]);

  const handlePurchase = useCallback(
    (product: any) => {
      setSelectedProduct(product);
      setDialogOpen(true);
      shop.selectProduct(product);
    },
    [shop]
  );

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedProduct(null);
    shop.setDialogOpen(false);
  };

  const handleConfirm = async () => {
    await confirmPurchase();
    setDialogOpen(false);
    setSelectedProduct(null);
  };

  const isLoading = productsLoading;
  const products = shop.products;

  const filteredProducts = category === 'all'
    ? products
    : products.filter((p) => p.type === category);

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

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-white/10 pb-4">
          {(['all', 'chips', 'season_pass', 'club_pro'] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                category === cat
                  ? 'bg-tertiary text-on-tertiary'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-on-surface-variant">
              No products available in this category.
            </div>
          ) : (
            filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onPurchase={handlePurchase} />
            ))
          )}
        </div>
      </div>

      <PurchaseDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onConfirm={handleConfirm}
        productName={selectedProduct?.name}
        priceEur={selectedProduct?.priceEur}
        priceStars={selectedProduct?.priceStars}
        provider="stripe"
        isProcessing={isProcessing}
      />
      <PurchaseToast />
    </div>
  );
}
