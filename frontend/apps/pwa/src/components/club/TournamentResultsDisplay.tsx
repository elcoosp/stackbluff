import { Trans } from '@lingui/react/macro';
import { apiClient } from '@stackbluff/shared/api/client';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TournamentResult {
  tournament_id: string;
  user_id: string;
  display_name?: string;
  position: number;
  prize: number;
}

interface TournamentResultsDisplayProps {
  tournamentId: string;
  tournamentName: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMedal(position: number): string {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return '';
}

export function TournamentResultsDisplay({
  tournamentId,
  tournamentName,
}: TournamentResultsDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    data: results,
    isLoading,
    error,
  } = useQuery<TournamentResult[]>({
    queryKey: ['tournament-results', tournamentId],
    queryFn: () => apiClient<TournamentResult[]>(`/tournaments/${tournamentId}/results`),
    enabled: !!tournamentId,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse flex items-center gap-2 text-on-surface-variant/60 text-sm">
        <Trans>Loading results...</Trans>
      </div>
    );
  }

  if (error || !results || results.length === 0) {
    return null;
  }

  const topThree = results.slice(0, 3);
  const remaining = results.slice(3);

  return (
    <Card className="p-4 bg-white/5 border-white/10">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold text-on-surface">
            <Trans>Results: {tournamentName}</Trans>
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-2">
          {/* Podium for top 3 */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {topThree.map((result) => (
              <div
                key={result.user_id}
                className={cn(
                  'text-center p-2 rounded-lg',
                  result.position === 1
                    ? 'bg-yellow-500/20 border border-yellow-500/30'
                    : result.position === 2
                      ? 'bg-gray-500/20 border border-gray-500/30'
                      : 'bg-orange-500/20 border border-orange-500/30',
                )}
              >
                <div className="text-2xl">{getMedal(result.position)}</div>
                <div className="text-sm font-medium text-on-surface truncate">
                  {result.display_name || result.user_id.slice(0, 8)}
                </div>
                <div className="text-xs text-tertiary font-mono">
                  {formatCurrency(result.prize)}
                </div>
              </div>
            ))}
          </div>

          {/* Remaining results */}
          {remaining.length > 0 && (
            <div className="space-y-1">
              {remaining.map((result) => (
                <div
                  key={result.user_id}
                  className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-on-surface-variant w-6 text-center">
                      #{result.position}
                    </span>
                    <span className="text-on-surface truncate">
                      {result.display_name || result.user_id.slice(0, 8)}
                    </span>
                  </div>
                  <span className="text-tertiary font-mono text-sm">
                    {formatCurrency(result.prize)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
