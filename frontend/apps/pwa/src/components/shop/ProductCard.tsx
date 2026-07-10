import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Coins, Crown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { getProductImageUrl } from '@/lib/productImages';

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

  const icon = isChips ? <Coins className="w-5 h-5" /> :
                isSeasonPass ? <Sparkles className="w-5 h-5" /> :
                <Crown className="w-5 h-5" />;

  const badgeText = isChips ? 'Chips' :
                    isSeasonPass ? 'Season Pass' :
                    'Club Pro';

  const imageUrl = getProductImageUrl(product.id, product.name);

  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/10 transition-all duration-300 hover:scale-[1.02] hover:border-tertiary/40',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image with blur/unblur on hover */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700"
        style={{
          backgroundImage: `url(${imageUrl})`,
          transform: isHovered ? 'scale(1.08)' : 'scale(1)',
          filter: isHovered ? 'blur(0px)' : 'blur(6px)',
        }}
      />

      {/* Dark overlay */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: isHovered
            ? 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 100%)'
            : 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 100%)',
        }}
      />

      {/* Content container: full height flex column */}
      <div className="relative z-10 flex flex-col h-full min-h-[320px] p-6">
        {/* Top section: centered vertically */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <div className="p-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 inline-flex">
            {icon}
          </div>
          <h3 className="font-semibold text-on-surface text-xl leading-tight drop-shadow-lg text-center">
            {product.name}
          </h3>
          <Badge variant="outline" className="border-tertiary/30 text-tertiary text-xs backdrop-blur-sm bg-black/20">
            {badgeText}
          </Badge>
        </div>

        {/* Bottom panel: price, description, button - rounded top corners, anchored at bottom */}
        <div
          className={cn(
            'mt-auto rounded-xl p-4 transition-all duration-500',
            isHovered
              ? 'bg-black/40 backdrop-blur-sm border-t border-white/10'
              : 'bg-black/60 backdrop-blur-md border-t border-white/5'
          )}
        >
          <div className="flex flex-col gap-2 items-center">
            <div className="flex items-center gap-4 text-sm">
              {product.priceEur > 0 && (
                <span className="text-tertiary font-mono text-lg drop-shadow-lg">
                  {formatPrice(product.priceEur)}
                </span>
              )}
              {product.priceStars > 0 && (
                <span className="text-yellow-400 font-mono text-sm drop-shadow-lg">
                  {formatStars(product.priceStars)}
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant/90 drop-shadow-md line-clamp-2 text-center">
              {product.description}
            </p>
            <Button
              onClick={() => onPurchase(product)}
              className={cn(
                'w-full transition-all duration-300 mt-1',
                isHovered
                  ? 'bg-tertiary text-on-tertiary hover:bg-tertiary/80 shadow-lg shadow-tertiary/30'
                  : 'bg-white/10 text-on-surface backdrop-blur-sm border border-white/20 hover:bg-tertiary/80'
              )}
            >
              Buy Now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
