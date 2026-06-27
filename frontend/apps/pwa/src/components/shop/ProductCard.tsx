import { motion } from 'framer-motion';
import { useIsMiniApp } from '../../hooks/usePaymentProvider';
import { useHasActiveSeasonPass, useHasActiveClubPro, useIsClubOwner, useSeasonPassExpiry } from '../../hooks/useEntitlements';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { Card } from '../ui/Card';
import type { Product } from '../../stores/shopStore';
import { SeasonPassTimer } from './SeasonPassTimer';

function formatPrice(product: Product, isMini: boolean): string {
  if (isMini) {
    return `${product.priceStars} Stars`;
  }
  return `€${product.priceEur.toFixed(2)}`;
}

function formatSecondaryPrice(product: Product, isMini: boolean): string {
  if (isMini) {
    return `€${product.priceEur.toFixed(2)}`;
  }
  return `${product.priceStars} Stars`;
}

interface ProductCardProps {
  product: Product;
  onPurchase: (product: Product) => void;
}

export function ProductCard({ product, onPurchase }: ProductCardProps) {
  const isMini = useIsMiniApp();
  const isClubOwner = useIsClubOwner();
  const hasSeasonPass = useHasActiveSeasonPass();
  const hasClubPro = useHasActiveClubPro();
  const seasonPassExpiry = useSeasonPassExpiry();

  if (product.type === 'club_pro' && !isClubOwner) {
    return null;
  }

  const isSeasonPassActive = product.type === 'season_pass' && hasSeasonPass;
  const isClubProActive = product.type === 'club_pro' && hasClubPro;

  return (
    <motion.div
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
            <div className="mb-1 text-lg font-bold text-white">{formatPrice(product, isMini)}</div>
            <div className="mb-4 text-sm text-slate-500">{formatSecondaryPrice(product, isMini)}</div>

            {isSeasonPassActive && seasonPassExpiry ? (
              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-400">
                  Active
                </span>
                <SeasonPassTimer expiresAt={seasonPassExpiry} />
              </div>
            ) : isClubProActive ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-400">
                Active
              </span>
            ) : (
              <LiquidMetalButton
                onClick={() => onPurchase(product)}
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
}
