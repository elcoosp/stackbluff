import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShopProducts } from '../hooks/useShopProducts';
import { usePurchaseFlow } from '../hooks/usePurchaseFlow';
import { useShopStore } from '../stores/shopStore';
import { ProductCard } from '../components/shop/ProductCard';
import { PurchaseDialog } from '../components/shop/PurchaseDialog';
import { PurchaseToast } from '../components/shop/PurchaseToast';
import { cn } from '@/lib/utils';
import { ShieldCheck, Zap, Loader2, ShoppingBag } from 'lucide-react';

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
      <div className="flex h-full min-h-screen items-center justify-center bg-[#131315]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-tertiary animate-spin" />
          <div className="animate-pulse text-lg text-on-surface-variant font-label-caps tracking-widest uppercase">Loading Shop...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#131315] group">
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center blur-md scale-105 group-hover:blur-none group-hover:scale-100 transition-all duration-500 ease-in-out z-0 pointer-events-none"
        style={{ backgroundImage: `url(/images/shop_bg.png)` }}
      />
      <div
        className="absolute inset-0 w-full h-full z-0 transition-all duration-500 pointer-events-none bg-gradient-to-t from-[#131315]/95 via-[#131315]/85 to-[#131315]/95"
      ></div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 md:mb-12">
          <div>
            <h1 className="font-display-lg text-4xl md:text-5xl text-on-surface mb-2">Shop</h1>
            <p className="text-on-surface-variant max-w-md text-sm md:text-base">
              Power up your game with premium chips, passes, and exclusive features.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-6 text-[10px] font-label-caps uppercase tracking-widest text-outline">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-tertiary" /> Secure Payments
            </span>
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-tertiary" /> Instant Delivery
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-10 border-b border-white/10 pb-4">
          {(['all', 'chips', 'season_pass', 'club_pro'] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-label-caps uppercase tracking-wider transition-all duration-200',
                category === cat
                  ? 'bg-tertiary text-on-tertiary shadow-lg shadow-emerald-500/20'
                  : 'text-outline hover:text-on-surface hover:bg-white/5 border border-transparent hover:border-white/10'
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-24 text-on-surface-variant border border-dashed border-white/10 rounded-xl">
              <ShoppingBag className="w-12 h-12 mb-4 text-outline" />
              <p className="font-label-caps uppercase tracking-widest">No products available in this category.</p>
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
