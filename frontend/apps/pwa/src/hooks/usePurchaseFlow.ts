import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useShopStore } from '../stores/shopStore';
import { createPaymentIntent } from '../lib/shopApi';
import { usePaymentProvider } from './usePaymentProvider';
import { useTelegramWebApp } from './useTelegramWebApp';
import { redirectToStripeCheckout } from '../lib/stripe';

export function usePurchaseFlow() {
  const queryClient = useQueryClient();
  const shop = useShopStore();
  const provider = usePaymentProvider();
  const { openInvoice } = useTelegramWebApp();
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

      // ── Stripe Checkout ──────────────────────────────────────────────
      if (provider === 'stripe' && intent.client_secret) {
        // Use the checkout_url if provided, otherwise fallback
        redirectToStripeCheckout(intent.client_secret, (intent as any).checkout_url);
        shop.setDialogOpen(false);
        shop.setToast({ message: 'Redirecting to payment...', type: 'success' });
        stopPolling();
        shop.setPurchasing(false);
        return;
      }

      // ── Telegram Stars ───────────────────────────────────────────────
      if (provider === 'telegram_stars' && intent.invoice_link) {
        const opened = openInvoice(intent.invoice_link, (result) => {
          if (result.status === 'paid') {
            shop.setDialogOpen(false);
            shop.setToast({ message: 'Purchase successful!', type: 'success' });
            startPolling();
          } else {
            shop.setError('Payment was not completed.');
            shop.setToast({ message: 'Payment cancelled.', type: 'error' });
          }
          shop.setPurchasing(false);
        });

        if (!opened) {
          window.open(intent.invoice_link, '_blank');
          shop.setPurchasing(false);
          shop.setDialogOpen(false);
        }
        return;
      }

      // ── Fallback ──────────────────────────────────────────────────────
      if (intent.redirect_url) {
        window.location.assign(intent.redirect_url);
        return;
      }

      shop.setError('Invalid payment response.');
      shop.setPurchasing(false);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Purchase failed';
      const msg = rawMsg.length > 120 ? 'Purchase failed. Please try again.' : rawMsg;
      shop.setError(msg);
      shop.setToast({ message: msg, type: 'error' });
      shop.setPurchasing(false);
    }
  }, [shop, provider, openInvoice, startPolling, stopPolling]);

  return { confirmPurchase, stopPolling };
}
