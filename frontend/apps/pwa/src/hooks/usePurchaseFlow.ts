import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useShopStore } from '../stores/shopStore';
import { createPaymentIntent } from '../lib/shopApi';
import { usePaymentProvider } from './usePaymentProvider';

export function usePurchaseFlow() {
  const queryClient = useQueryClient();
  const shop = useShopStore();
  const provider = usePaymentProvider();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    let attempts = 0;
    const maxAttempts = 12;
    pollRef.current = setInterval(() => {
      attempts++;
      queryClient.invalidateQueries({ queryKey: ['user-me'] });
      if (attempts >= maxAttempts && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 5000);
  }, [queryClient]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const confirmPurchase = useCallback(async () => {
    const product = shop.selectedProduct;
    if (!product) return;

    shop.setPurchasing(true);
    shop.setError(null);

    try {
      const intent = await createPaymentIntent({ product_id: product.id, provider });

      if (provider === 'telegram_stars' && intent.invoice_link) {
        const tg = window.Telegram?.WebApp;
        if (tg?.openInvoice) {
          tg.openInvoice(intent.invoice_link, (status) => {
            if (status === 'paid') {
              shop.setDialogOpen(false);
              shop.setToast({ message: 'Purchase successful!', type: 'success' });
              startPolling();
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
        window.location.assign(intent.redirect_url);
        return;
      } else if (intent.client_secret) {
        shop.setError('Stripe.js integration not yet configured.');
        shop.setPurchasing(false);
      } else {
        shop.setError('Invalid payment response.');
        shop.setPurchasing(false);
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Purchase failed';
      const msg = rawMsg.length > 120 ? 'Purchase failed. Please try again.' : rawMsg;
      shop.setError(msg);
      shop.setToast({ message: msg, type: 'error' });
      shop.setPurchasing(false);
    }
  }, [shop, provider, startPolling]);

  return { confirmPurchase, stopPolling };
}
