import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal } from 'lucide-react';

export interface PayoutEntry {
  position: number;
  percentage: number;
}

interface PayoutStructurePreviewProps {
  entries: PayoutEntry[];
  prizePool: number;
  className?: string;
}

function getMedal(position: number): string {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return '';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PayoutStructurePreview({ entries, prizePool, className }: PayoutStructurePreviewProps) {
  if (!entries || entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => a.position - b.position);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          Payout Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-white/5">
          {sorted.map((entry) => {
            const amount = (prizePool * entry.percentage) / 100;
            const isTop3 = entry.position <= 3;
            return (
              <div
                key={entry.position}
                className={cn(
                  'flex items-center justify-between px-3 py-2 transition-colors',
                  isTop3 ? 'bg-white/5' : 'hover:bg-white/5'
                )}
              >
                <div className="flex items-center gap-2">
                  {isTop3 ? (
                    <span className="text-lg">{getMedal(entry.position)}</span>
                  ) : (
                    <span className="w-6 text-center text-xs font-mono text-on-surface-variant">
                      #{entry.position}
                    </span>
                  )}
                  <span className="text-sm text-on-surface">
                    {entry.position}{entry.position === 1 ? 'st' : entry.position === 2 ? 'nd' : 'th'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-on-surface-variant">
                    {entry.percentage}%
                  </span>
                  <span className="text-sm font-mono text-tertiary font-semibold">
                    {formatCurrency(amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
