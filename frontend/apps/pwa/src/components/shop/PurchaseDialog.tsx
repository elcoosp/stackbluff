import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Trans, t } from '@lingui/react/macro';

interface PurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  productName?: string;
  priceEur?: number;
  priceStars?: number;
  provider?: 'stripe' | 'telegram_stars';
  isProcessing?: boolean;
}

export function PurchaseDialog({
  open,
  onClose,
  onConfirm,
  productName,
  priceEur,
  priceStars,
  provider = 'stripe',
  isProcessing = false,
}: PurchaseDialogProps) {
  // Determine which price to display based on provider
  let priceDisplay = '';
  if (provider === 'telegram_stars' && priceStars !== undefined && priceStars > 0) {
    priceDisplay = `${priceStars} ⭐`;
  } else if (priceEur !== undefined && priceEur > 0) {
    priceDisplay = `€${priceEur.toFixed(2)}`;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface-container border border-white/10 rounded-xl max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-on-surface text-xl font-semibold text-center">
            <Trans>Confirm Purchase</Trans>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-on-surface-variant text-sm text-center">
            <Trans>You are about to purchase <span className="text-on-surface font-medium">{productName || 'this item'}</span>
            {priceDisplay && <span className="text-tertiary font-mono ml-1">for {priceDisplay}</span>}
            .</Trans>
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 border-white/20 text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex-1 bg-tertiary text-on-tertiary hover:bg-tertiary/80"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <Trans>Processing...</Trans>
                </>
              ) : (
                <Trans>Confirm</Trans>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
