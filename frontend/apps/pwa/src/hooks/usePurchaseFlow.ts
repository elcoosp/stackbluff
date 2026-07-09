import { useState } from 'react';
import { useShopStore } from '../stores/shopStore';
import { createPaymentIntent, CreateIntentRequest } from '../lib/shopApi';
import { toast } from 'sonner';

export function usePurchaseFlow() {
  const shop = useShopStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const confirmPurchase = async () => {
    const product = shop.selectedProduct;
    if (!product) {
      toast.error('No product selected');
      return;
    }

    setIsProcessing(true);
    shop.setError(null);

    try {
      const req: CreateIntentRequest = {
        product_id: product.id,
        provider: 'stripe', // TODO: allow user to choose
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

      shop.setDialogOpen(false);
    } catch (error: any) {
      const message = error.message || 'Purchase failed';
      shop.setError(message);
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
