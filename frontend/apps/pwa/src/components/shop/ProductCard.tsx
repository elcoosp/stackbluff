import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Coins, Crown, Sparkles, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { getProductImageUrl } from '@/lib/productImages';
import { Trans, t } from '@lingui/react/macro';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string;
    priceEur: number;
    priceStars: number;
    type: 'chips' | 'season_pass' | 'club_pro';
    chipsAmount?: number;
    durationDays?: number;
  };
  onPurchase: (product: any) => void;
  className?: string;
}

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

function formatStars(stars: number): string {
  return `${stars} ⭐`;
}

export function ProductCard({ product, onPurchase, className }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isChips = product.type === 'chips';
  const isSeasonPass = product.type === 'season_pass';
  const isClubPro = product.type === 'club_pro';

  const icon = isChips ? <Coins className="w-5 h-5 text-tertiary" /> :
                isSeasonPass ? <Sparkles className="w-5 h-5 text-tertiary" /> :
                <Crown className="w-5 h-5 text-tertiary" />;

  const badgeText = isChips ? t`Chips` :
                    isSeasonPass ? t`Season Pass` :
                    t`Club Pro`;

  const imageUrl = getProductImageUrl(product.id, product.name);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/10 transition-all duration-300 group hover:scale-[1.02] hover:border-tertiary/40 hover:shadow-xl hover:shadow-emerald-500/10',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image with scale on hover */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700 ease-in-out"
        style={{
          backgroundImage: `url(${imageUrl})`,
          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        }}
      />

      {/* Luxury Dark Glass Overlay */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: isHovered
            ? 'linear-gradient(to bottom, rgba(19, 19, 21, 0.4) 0%, rgba(19, 19, 21, 0.8) 100%)'
            : 'linear-gradient(to bottom, rgba(19, 19, 21, 0.7) 0%, rgba(19, 19, 21, 0.5) 100%)',
        }}
      />

      {/* Razor Highlight top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      {/* Content container */}
      <div className="relative z-10 flex flex-col h-full min-h-[340px] p-6">
        {/* Top section */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <div className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 inline-flex shadow-lg">
            {icon}
          </div>
          <h3 className="font-headline-md text-2xl text-on-surface leading-tight drop-shadow-lg">
            {product.name}
          </h3>
          <Badge variant="outline" className="border-tertiary/40 text-tertiary text-[10px] font-label-caps uppercase tracking-widest backdrop-blur-md bg-black/30">
            {badgeText}
          </Badge>
        </div>

        {/* Bottom panel */}
        <div
          className={cn(
            'mt-auto rounded-xl p-4 transition-all duration-500 border',
            isHovered
              ? 'bg-black/60 backdrop-blur-xl border-tertiary/20 shadow-lg'
              : 'bg-black/40 backdrop-blur-md border-white/5'
          )}
        >
          <div className="flex flex-col gap-3 items-center">
            <div className="flex items-center gap-4 font-data-mono">
              {product.priceEur > 0 && (
                <span className="text-tertiary text-xl drop-shadow-lg font-bold">
                  {formatPrice(product.priceEur)}
                </span>
              )}
              {product.priceStars > 0 && (
                <span className="text-yellow-400 text-sm drop-shadow-lg font-bold">
                  {formatStars(product.priceStars)}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/80 drop-shadow-md line-clamp-2 text-center font-body-md">
              {product.description}
            </p>
            <Button
              onClick={() => onPurchase(product)}
              className={cn(
                'w-full transition-all duration-300 mt-1 font-label-caps text-label-caps uppercase tracking-wider',
                isHovered
                  ? 'bg-tertiary text-on-tertiary hover:bg-tertiary-fixed shadow-lg shadow-emerald-500/30'
                  : 'bg-white/10 text-on-surface backdrop-blur-sm border border-white/20 hover:bg-tertiary hover:text-on-tertiary'
              )}
            >
              <ShieldCheck className="w-3 h-3 mr-2" /> <Trans>Buy Now</Trans>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
