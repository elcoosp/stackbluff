import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

export interface BlindLevel {
  level: number;
  small_blind: number;
  big_blind: number;
  ante?: number;
  duration_secs: number;
}

interface BlindSchedulePreviewProps {
  levels: BlindLevel[];
  currentLevel?: number;
  className?: string;
}

export function BlindSchedulePreview({ levels, currentLevel, className }: BlindSchedulePreviewProps) {
  if (!levels || levels.length === 0) return null;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold"><Trans>Blind Schedule</Trans></CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left py-2 px-3 text-[10px] font-mono text-on-surface-variant uppercase tracking-wider"><Trans>Level</Trans></th>
                <th className="text-left py-2 px-3 text-[10px] font-mono text-on-surface-variant uppercase tracking-wider"><Trans>Small</Trans></th>
                <th className="text-left py-2 px-3 text-[10px] font-mono text-on-surface-variant uppercase tracking-wider"><Trans>Big</Trans></th>
                <th className="text-left py-2 px-3 text-[10px] font-mono text-on-surface-variant uppercase tracking-wider"><Trans>Ante</Trans></th>
                <th className="text-left py-2 px-3 text-[10px] font-mono text-on-surface-variant uppercase tracking-wider"><Trans>Duration</Trans></th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => {
                const isCurrent = currentLevel !== undefined && level.level === currentLevel;
                return (
                  <tr
                    key={level.level}
                    className={cn(
                      'border-b border-white/5 transition-colors',
                      isCurrent ? 'bg-tertiary/10' : 'hover:bg-white/5'
                    )}
                  >
                    <td className="py-2 px-3 font-mono">
                      <span className={cn(isCurrent ? 'text-tertiary font-bold' : 'text-on-surface')}>
                        {level.level}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-on-surface">${level.small_blind}</td>
                    <td className="py-2 px-3 font-mono text-on-surface">${level.big_blind}</td>
                    <td className="py-2 px-3 font-mono text-on-surface">
                      {level.ante && level.ante > 0 ? `$${level.ante}` : '-'}
                    </td>
                    <td className="py-2 px-3 font-mono text-on-surface-variant">
                      {level.duration_secs}s
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
