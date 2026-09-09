import { t } from '@lingui/core/macro';
import { cn } from '@/lib/utils';

export type RankTier =
  | 'brick'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'maestro'
  | 'legend';

const RANK_CONFIG: Record<RankTier, { label: string; emoji: string; color: string }> = {
  brick: { label: t`Brick`, emoji: '🧱', color: 'text-amber-800' },
  bronze: { label: t`Bronze`, emoji: '🥉', color: 'text-amber-600' },
  silver: { label: t`Silver`, emoji: '🥈', color: 'text-gray-300' },
  gold: { label: t`Gold`, emoji: '🥇', color: 'text-yellow-400' },
  platinum: { label: t`Platinum`, emoji: '💿', color: 'text-cyan-300' },
  diamond: { label: t`Diamond`, emoji: '💎', color: 'text-blue-300' },
  maestro: { label: t`Maestro`, emoji: '🎭', color: 'text-purple-400' },
  legend: { label: t`Legend`, emoji: '👑', color: 'text-yellow-500' },
};

interface RankTierBadgeProps {
  tier: RankTier | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export function RankTierBadge({
  tier,
  size = 'md',
  className,
  showLabel = true,
}: RankTierBadgeProps) {
  const normalized = tier?.toLowerCase() as RankTier;
  const config = RANK_CONFIG[normalized];
  if (!config) return null;

  const sizeClasses = {
    sm: 'text-xs gap-1 px-2 py-0.5',
    md: 'text-sm gap-1.5 px-2.5 py-1',
    lg: 'text-base gap-2 px-3 py-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border border-white/10 bg-white/5',
        sizeClasses[size],
        config.color,
        className,
      )}
    >
      <span className="text-base">{config.emoji}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
