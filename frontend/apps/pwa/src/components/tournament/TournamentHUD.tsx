import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Trophy, Users, Coins, Info, Timer, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimerBar } from '@/components/game/TimerBar';
import { useTournament } from '@stackbluff/shared/hooks/useTournament';
import { tournamentApi } from '@stackbluff/shared/api/tournamentApi';
import { useTournamentStore } from '@stackbluff/shared/stores/tournamentStore';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import type { TournamentState } from '@stackbluff/shared/types/tournament.types';
import { Trans, Plural } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface TournamentHUDProps {
  tournamentId: string;
  isMobile?: boolean;
  heroStack?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function getChipColor(value: number): string {
  if (value >= 70) return 'text-tertiary';
  if (value >= 40) return 'text-amber-400';
  return 'text-red-400';
}

export function TournamentHUD({ tournamentId, isMobile = false, heroStack = 0 }: TournamentHUDProps) {
  const [expanded, setExpanded] = useState(!isMobile);
  const [showPayouts, setShowPayouts] = useState(false);
  const { state } = useTournament(tournamentId);
  const payouts = useTournamentStore((s) => s.payouts[tournamentId]);
  const setPayouts = useTournamentStore((s) => s.setPayouts);
  const balance = useAuthStore((s) => s.balance);

  // ── Fetch payout structure ──
  useEffect(() => {
    if (tournamentId && !payouts) {
      tournamentApi.getPayoutStructure(tournamentId).then((p) => {
        if (p && p.length > 0) setPayouts(tournamentId, p);
      }).catch(() => {
        // fallback to default structure
        setPayouts(tournamentId, [
          { position: 1, percentage: 0.5 },
          { position: 2, percentage: 0.3 },
          { position: 3, percentage: 0.2 },
        ]);
      });
    }
  }, [tournamentId, payouts, setPayouts]);

  if (!state) {
    return (
      <div className="bg-surface-container/80 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 min-w-[200px]">
        <div className="animate-pulse h-8 w-full bg-white/5 rounded" />
      </div>
    );
  }

  const {
    registered_count,
    max_players,
    prize_pool,
    blind_level,
    players_remaining,
    next_blind_at,
  } = state;

  const playersLeft = players_remaining ?? registered_count;
  const totalPlayers = max_players;
  const progress = totalPlayers > 0 ? (playersLeft / totalPlayers) * 100 : 100;

  const [blinds, setBlinds] = useState<{ smallBlind: number; bigBlind: number } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.tournamentId === tournamentId && detail.blinds) {
        setBlinds(detail.blinds);
      }
    };
    window.addEventListener('tournament:blind_level', handler as EventListener);
    return () => window.removeEventListener('tournament:blind_level', handler as EventListener);
  }, [tournamentId]);

  const blindText = blinds ? `${blinds.smallBlind}/${blinds.bigBlind}` : t`Level ${blind_level || '?'}`;

  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!next_blind_at) {
      setTimeRemaining(null);
      return;
    }
    const update = () => {
      const now = Date.now();
      const remaining = Math.max(0, next_blind_at - now);
      setTimeRemaining(remaining);
    };
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [next_blind_at]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'bg-surface-container/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden',
        isMobile ? 'w-full' : 'w-64'
      )}
    >
      {/* Header – click to expand/collapse */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-tertiary" />
          <span className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant">
            <Trans>Tournament</Trans>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-data-mono text-xs text-tertiary">
            <Trans>Level {blind_level || '?'}</Trans>
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Blind level and timer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-on-surface-variant/60" />
                  <span className="font-data-mono text-xs text-on-surface">{blindText}</span>
                </div>
                {timeRemaining !== null && timeRemaining > 0 && (
                  <div className="w-24">
                    <TimerBar remainingMs={timeRemaining} totalMs={timeRemaining} isActive />
                  </div>
                )}
              </div>

              {/* Players remaining */}
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-on-surface-variant"><Trans>Players Left</Trans></span>
                  <span className="font-data-mono text-on-surface font-bold">{playersLeft} / {totalPlayers}</span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-tertiary/60 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Prize pool with payout tooltip */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPayouts(!showPayouts)}
                  className="w-full flex items-center justify-between text-[11px] hover:text-tertiary transition-colors"
                >
                  <span className="text-on-surface-variant flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" />
                    <Trans>Prize Pool</Trans>
                  </span>
                  <span className="font-data-mono text-tertiary font-bold">{formatCurrency(prize_pool)}</span>
                </button>
                <AnimatePresence>
                  {showPayouts && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute left-0 right-0 top-full mt-2 bg-surface-container border border-white/10 rounded-lg p-3 z-10 shadow-xl"
                    >
                      <div className="text-[10px] text-on-surface-variant font-label-caps uppercase tracking-wider mb-2">
                        <Trans>Payout Structure</Trans>
                      </div>
                      <div className="space-y-1 text-xs">
                        {payouts && payouts.length > 0 ? (
                          payouts.slice(0, 5).map((p) => (
                            <div key={p.position} className="flex justify-between text-on-surface-variant">
                              <span>
                                {p.position}
                                {p.position === 1 ? 'st' : p.position === 2 ? 'nd' : 'th'}:
                              </span>
                              <span className="text-tertiary">{(p.percentage * 100).toFixed(0)}%</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-on-surface-variant text-[10px]"><Trans>Loading payouts...</Trans></div>
                        )}
                        <div className="text-[9px] text-on-surface-variant/50 mt-1">
                          <Trans>* Based on prize pool</Trans>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Your stack - will be passed from TablePage */}
              <div className="flex items-center justify-between text-[11px] border-t border-white/5 pt-2">
                <span className="text-on-surface-variant"><Trans>Your Stack</Trans></span>
                <span className="font-data-mono text-tertiary font-bold">
                  {/* Will be passed from TablePage via prop */}
                  ${heroStack.toLocaleString()}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
