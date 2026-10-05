import { useState } from 'react';
import { toast } from 'sonner';
import { type CreateIntentRequest, createPaymentIntent } from '../lib/shopApi';
import { useShopStore } from '../stores/shopStore';

export function usePurchaseFlow() {
  // F-18 FIX: previously subscribed to the WHOLE shop store (a render
  // storm on any store update) and hardcoded `provider: 'stripe'`, pushing
  // Mini-App users through external card checkout even though the backend
  // supports Telegram Stars. Pick per-store slices and choose the
  // provider by runtime environment.
  const selectedProduct = useShopStore((s) => s.selectedProduct);
  const setError = useShopStore((s) => s.setError);
  const setDialogOpen = useShopStore((s) => s.setDialogOpen);
  const [isProcessing, setIsProcessing] = useState(false);

  const isMiniApp =
    typeof window !== 'undefined' &&
    !!(window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;
  const provider = isMiniApp ? 'telegram_stars' : 'stripe';

  const confirmPurchase = async () => {
    const product = selectedProduct;
    if (!product) {
      toast.error('No product selected');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const req: CreateIntentRequest = {
        product_id: product.id,
        // F-18 FIX: choose by environment instead of hardcoding Stripe.
        provider,
      };
      const response = await createPaymentIntent(req);

      if (response.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = response.checkout_url;
      } else if (response.invoice_link) {
        // For Telegram Stars, open invoice link
        window.open(response.invoice_link, '_blank');
      } else if (response.client_secret) {
        // Handle payment intent client secret (for custom payment flow)
        toast.success('Payment intent created');
      } else {
        toast.success('Purchase initiated!');
      }

      setDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Purchase failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopPolling = () => {
    // No polling needed for now
  };

  return { confirmPurchase, stopPolling, isProcessing };
}
