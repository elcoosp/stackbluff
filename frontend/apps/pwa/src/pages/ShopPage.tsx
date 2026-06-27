import { useEffect, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useShopStore, type Product } from '../stores/shopStore';
import { useAuthStore } from '../stores/authStore';
import { useEntitlementsStore } from '../stores/entitlementsStore';
import { fetchProducts, createPaymentIntent, fetchUserMe } from '../lib/shopApi';
import { getPaymentProvider, isMiniApp } from '../lib/platform';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

function SeasonPassTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => {
    const exp = new Date(expiresAt);
    if (isNaN(exp.getTime())) return 0;
    return Math.max(0, exp.getTime() - Date.now());
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const exp = new Date(expiresAt);
      if (isNaN(exp.getTime())) {
        setRemaining(0);
        return;
      }
      const diff = exp.getTime() - Date.now();
      setRemaining(Math.max(0, diff));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (remaining === 0) return <span className="text-sm text-red-400">Expired</span>;

  return (
    <span className="text-sm text-emerald-400">
      {days}d {hours}h remaining
    </span>
  );
}

function formatPrice(product: Product): string {
  if (isMiniApp()) {
    return `${product.priceStars} Stars`;
  }
  return `€${product.priceEur.toFixed(2)}`;
}

function formatSecondaryPrice(product: Product): string {
  if (isMiniApp()) {
    return `€${product.priceEur.toFixed(2)}`;
  }
  return `${product.priceStars} Stars`;
}

export default function ShopPage() {
  const queryClient = useQueryClient();
  const shop = useShopStore();
  const auth = useAuthStore();
  const entitlements = useEntitlementsStore();

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['shop-products'],
    queryFn: fetchProducts,
  });

  const { isLoading: userLoading } = useQuery({
    queryKey: ['user-me'],
    queryFn: async () => {
      const user = await fetchUserMe();
      auth.setBalance(user.balance);
      entitlements.setSeasonPassExpiresAt(user.season_pass_expires_at);
      entitlements.setClubProExpiresAt(user.club_pro_expires_at);
      entitlements.setIsClubOwner(user.is_club_owner);
      return user;
    },
  });

  useEffect(() => {
    if (!shop.isPurchasing) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['user-me'] });
    }, 5000);
    return () => clearInterval(interval);
  }, [shop.isPurchasing, queryClient]);

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
    (product: Product) => {
      shop.selectProduct(product);
      shop.setDialogOpen(true);
      shop.setError(null);
    },
    [shop]
  );

  const confirmPurchase = useCallback(async () => {
    const product = shop.selectedProduct;
    if (!product) return;

    shop.setPurchasing(true);
    shop.setError(null);

    try {
      const provider = getPaymentProvider();
      const intent = await createPaymentIntent({ product_id: product.id, provider });

      if (provider === 'telegram_stars' && intent.invoice_link) {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openInvoice) {
          tg.openInvoice(intent.invoice_link, (status: string) => {
            if (status === 'paid') {
              shop.setDialogOpen(false);
              shop.setToast({ message: 'Purchase successful!', type: 'success' });
              queryClient.invalidateQueries({ queryKey: ['user-me'] });
            } else {
              shop.setError('Payment was not completed.');
              shop.setToast({ message: 'Payment cancelled.', type: 'error' });
            }
            shop.setPurchasing(false);
          });
        } else {
          window.open(intent.invoice_link, '_blank');
          shop.setPurchasing(false);
          shop.setDialogOpen(false);
        }
      } else if (intent.redirect_url) {
        window.location.href = intent.redirect_url;
        return;
      } else if (intent.client_secret) {
        shop.setError('Stripe.js integration not yet configured.');
        shop.setPurchasing(false);
      } else {
        shop.setError('Invalid payment response.');
        shop.setPurchasing(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Purchase failed';
      shop.setError(msg);
      shop.setToast({ message: msg, type: 'error' });
      shop.setPurchasing(false);
    }
  }, [shop, queryClient]);

  useEffect(() => {
    if (!shop.toast) return;
    const timer = setTimeout(() => shop.setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [shop.toast, shop]);

  const isLoading = productsLoading || userLoading;
  const products = shop.products;
  const isClubOwner = entitlements.isClubOwner;

  if (isLoading && products.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-lg text-slate-400">Loading shop...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] bg-[url('/carbon-fibre.png')] p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold text-white md:text-4xl">Shop</h1>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            if (product.type === 'club_pro' && !isClubOwner) {
              return null;
            }

            const isSeasonPassActive =
              product.type === 'season_pass' && entitlements.hasActiveSeasonPass();

            const isClubProActive =
              product.type === 'club_pro' && entitlements.hasActiveClubPro();

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <GlassPanel className="flex flex-col p-6">
                  <Card className="flex flex-1 flex-col border-0 bg-transparent">
                    <div className="flex-1">
                      <h3 className="mb-2 text-xl font-semibold text-white">{product.name}</h3>
                      <p className="mb-4 text-sm text-slate-300">{product.description}</p>
                      {product.chipsAmount ? (
                        <p className="mb-4 text-2xl font-bold text-amber-400">
                          {product.chipsAmount.toLocaleString()} chips
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 text-lg font-bold text-white">{formatPrice(product)}</div>
                      <div className="mb-4 text-sm text-slate-500">{formatSecondaryPrice(product)}</div>

                      {product.type === 'season_pass' && isSeasonPassActive && entitlements.seasonPassExpiresAt ? (
                        <div className="flex flex-col gap-2">
                          <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-400">
                            Active
                          </span>
                          <SeasonPassTimer expiresAt={entitlements.seasonPassExpiresAt} />
                        </div>
                      ) : product.type === 'club_pro' && isClubProActive ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-400">
                          Active
                        </span>
                      ) : (
                        <LiquidMetalButton
                          onClick={() => handlePurchase(product)}
                          disabled={product.type === 'club_pro' && !isClubOwner}
                        >
                          {product.type === 'club_pro' ? 'Unlock' : 'Buy Now'}
                        </LiquidMetalButton>
                      )}

                      {product.type === 'club_pro' && !isClubOwner ? (
                        <p className="mt-2 text-xs text-red-400">Requires a club</p>
                      ) : null}
                    </div>
                  </Card>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>
      </div>

      <Dialog open={shop.isDialogOpen} onOpenChange={(open) => shop.setDialogOpen(open)}>
        <DialogContent className="bg-[#1a1a1a] text-white">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
          </DialogHeader>
          {shop.selectedProduct ? (
            <div className="space-y-4 py-4">
              <p>
                You are about to purchase <strong>{shop.selectedProduct.name}</strong> for{' '}
                <strong>{formatPrice(shop.selectedProduct)}</strong>.
              </p>
              {shop.error ? <p className="text-sm text-red-400">{shop.error}</p> : null}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => shop.setDialogOpen(false)}
                  disabled={shop.isPurchasing}
                >
                  Cancel
                </Button>
                <LiquidMetalButton onClick={confirmPurchase} disabled={shop.isPurchasing}>
                  {shop.isPurchasing ? 'Processing...' : 'Confirm'}
                </LiquidMetalButton>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {shop.toast ? (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-6 py-3 text-sm font-medium text-white shadow-lg ${
            shop.toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {shop.toast.message}
        </motion.div>
      ) : null}
    </div>
  );
}
