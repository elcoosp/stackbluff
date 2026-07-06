import { useIsMiniApp } from '../../hooks/usePaymentProvider';
import { useShopStore } from '../../stores/shopStore';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import type { Product } from '../../stores/shopStore';

function formatPrice(product: Product, isMini: boolean): string {
  if (isMini) {
    return `${product.priceStars} Stars`;
  }
  return `€${product.priceEur.toFixed(2)}`;
}

interface PurchaseDialogProps {
  onConfirm: () => void;
}

export function PurchaseDialog({ onConfirm }: PurchaseDialogProps) {
  const isMini = useIsMiniApp();
  const shop = useShopStore();

  const product = shop.selectedProduct;

  return (
    <Dialog open={shop.isDialogOpen} onOpenChange={(open) => shop.setDialogOpen(open)}>
      <DialogContent className="bg-[#1a1a1a] text-white">
        <DialogHeader>
          <DialogTitle>Confirm Purchase</DialogTitle>
        </DialogHeader>
        {product ? (
          <div className="space-y-4 py-4">
            <p>
              You are about to purchase <strong>{product.name}</strong> for{' '}
              <strong>{formatPrice(product, isMini)}</strong>.
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
              <LiquidMetalButton onClick={onConfirm} disabled={shop.isPurchasing}>
                {shop.isPurchasing ? 'Processing...' : 'Confirm'}
              </LiquidMetalButton>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
