import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { TournamentSummary } from '@stackbluff/shared/types/tournament.types';
import { Clock, Users, Trophy, Zap, Eye } from 'lucide-react';
import { TimerBar } from '@/components/game/TimerBar';

interface TournamentCardProps {
  tournament: TournamentSummary;
  isRegistered: boolean;
  isRegistering: boolean;
  isUnregistering: boolean;
  onRegister: () => void;
  onUnregister: () => void;
  onSpectate: () => void;
  onPlay: () => void;
  onResults: () => void;
}

function formatCurrency(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Registering': return 'text-tertiary border-tertiary/40';
    case 'Running': return 'text-blue-400 border-blue-400/40';
    case 'Completed': return 'text-gray-400 border-gray-400/40';
    default: return 'text-gray-500 border-gray-500/40';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'Registering': return 'Registering';
    case 'Running': return 'Live';
    case 'Completed': return 'Completed';
    default: return status;
  }
}

function getStakeLabel(buy_in: number): string {
  if (buy_in <= 100) return 'Micro';
  if (buy_in <= 250) return 'Low';
  if (buy_in <= 500) return 'Medium';
  if (buy_in <= 2000) return 'High';
  return 'Very High';
}

function getStakeText(buy_in: number): string {
  if (buy_in <= 100) return '$0.02/$0.05';
  if (buy_in <= 250) return '$0.10/$0.25';
  if (buy_in <= 500) return '$0.50/$1.00';
  if (buy_in <= 2000) return '$2/$4';
  return '$5/$10';
}

function getTournamentBg(name: string, buy_in: number): string {
  if (name.toLowerCase().includes('weekend') || buy_in >= 500) {
    return '/images/tournaments/bg_weekend_mtt.png';
  }
  if (buy_in <= 100) {
    return '/images/tournaments/bg_micro_sng.png';
  }
  return '/images/tournaments/bg_standard_sng.png';
}

export function TournamentCard({
  tournament,
  isRegistered,
  isRegistering,
  isUnregistering,
  onRegister,
  onUnregister,
  onSpectate,
  onPlay,
  onResults,
}: TournamentCardProps) {
  const {
    id,
    name,
    tournament_type,
    status,
    registered,
    max_players,
    min_players_to_start,
    starts_in_seconds,
    buy_in,
    prize_pool,
    current_blind_level,
    started_at,
  } = tournament;

  const isFull = registered >= max_players;
  const isRegisteringStatus = status === 'Registering';
  const isRunning = status === 'Running';
  const isCompleted = status === 'Completed';

  const canRegister = isRegisteringStatus && !isFull && !isRegistered && !isRegistering;
  const canUnregister = isRegisteringStatus && isRegistered && !isUnregistering;
  const canSpectate = isRunning && !isRegistered;
  const canPlay = isRunning && isRegistered;
  const canResults = isCompleted;

  const showCountdown = isRegisteringStatus && starts_in_seconds !== undefined && starts_in_seconds > 0;
  const needsPlayers = isRegisteringStatus && starts_in_seconds === undefined && registered < min_players_to_start;

  const bgImage = getTournamentBg(name, buy_in);

  return (
    <motion.div
      layout
      data-tournament-id={id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative flex flex-col lg:grid lg:grid-cols-12 items-start lg:items-center px-4 lg:px-8 py-4 lg:py-5 border border-white/10 rounded-xl overflow-hidden razor-highlight group hover:border-tertiary/40 transition-colors duration-200 gap-3 lg:gap-0"
    >
      <img
        src={bgImage}
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
      />
      <div
        className="absolute inset-0 backdrop-blur-xl bg-surface-container-lowest/80 z-10 pointer-events-none"
      ></div>

      <div className="relative z-20 w-full lg:col-span-5 flex items-start lg:items-center gap-3 lg:gap-4">
        <div className="flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(status)} border`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-headline-md text-base text-on-surface truncate">{name}</h4>
            <span
              data-testid="tournament-status"
              data-status={status}
              className={`text-[9px] font-label-caps uppercase px-2 py-0.5 rounded-full border ${getStatusColor(status)}`}
            >
              {getStatusLabel(status)}
            </span>
            <span className="text-[9px] font-label-caps uppercase text-tertiary border border-tertiary/30 px-2 py-0.5 rounded-full">
              {tournament_type === 'SitAndGo' ? 'S&G' : 'MTT'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-on-surface-variant">
            <span>{getStakeText(buy_in)}</span>
            <span>•</span>
            <span>Buy-in {formatCurrency(buy_in)}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              {formatCurrency(prize_pool)}
            </span>
            {current_blind_level && (
              <>
                <span>•</span>
                <span>Level {current_blind_level}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-20 lg:col-span-2 text-center font-data-mono">
        <div className="flex items-center justify-center gap-1">
          <Users className="w-3.5 h-3.5 text-outline" />
          <span className="text-on-surface">{registered}/{max_players}</span>
        </div>
      </div>

      <div className="relative z-20 lg:col-span-2 w-full">
        {showCountdown && (
          <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
            <Clock className="w-3 h-3" />
            <TimerBar remainingMs={starts_in_seconds * 1000} totalMs={starts_in_seconds * 1000} isActive />
            <span className="font-mono">{starts_in_seconds}s</span>
          </div>
        )}
        {needsPlayers && (
          <div className="text-[10px] text-on-surface-variant">
            Needs {min_players_to_start - registered} more player{min_players_to_start - registered > 1 ? 's' : ''}
          </div>
        )}
        {isRegisteringStatus && starts_in_seconds === 0 && (
          <div className="text-[10px] text-tertiary">Starting soon…</div>
        )}
      </div>

      <div className="relative z-20 w-full lg:col-span-3 flex lg:justify-end gap-2 mt-1 lg:mt-0">
        {canRegister && (
          <Button
            data-testid="register"
            onClick={onRegister}
            disabled={isRegistering || isFull}
            className="flex-1 lg:flex-initial px-3 lg:px-4 py-2 bg-tertiary text-on-tertiary font-label-caps text-[10px] hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-lg"
          >
            {isRegistering ? 'Registering...' : isFull ? 'Full' : 'Register'}
          </Button>
        )}
        {canUnregister && (
          <Button
            data-testid="unregister"
            onClick={onUnregister}
            disabled={isUnregistering}
            variant="outline"
            className="flex-1 lg:flex-initial px-3 lg:px-4 py-2 border-outline-variant text-on-surface hover:border-red-400 hover:text-red-400 font-label-caps text-[10px] uppercase tracking-wider rounded-lg"
          >
            {isUnregistering ? '...' : 'Unregister'}
          </Button>
        )}
        {isRegistered && isRunning && (
          <Button
            data-testid="play"
            onClick={onPlay}
            className="flex-1 lg:flex-initial px-3 lg:px-4 py-2 bg-tertiary text-on-tertiary font-label-caps text-[10px] hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-lg"
          >
            <Zap className="w-3 h-3 mr-1" />
            Play
          </Button>
        )}
        {canSpectate && (
          <Button
            data-testid="spectate"
            onClick={onSpectate}
            variant="outline"
            className="flex-1 lg:flex-initial px-3 lg:px-4 py-2 border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary font-label-caps text-[10px] uppercase tracking-wider rounded-lg"
          >
            <Eye className="w-3 h-3 mr-1" />
            Spectate
          </Button>
        )}
        {canResults && (
          <Button
            data-testid="results"
            onClick={onResults}
            variant="outline"
            className="flex-1 lg:flex-initial px-3 lg:px-4 py-2 border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary font-label-caps text-[10px] uppercase tracking-wider rounded-lg"
          >
            Results
          </Button>
        )}
        {isRegistered && isRegisteringStatus && (
          <span
            data-testid="registered-badge"
            className="flex-1 lg:flex-initial px-3 py-2 text-center text-[10px] text-tertiary font-label-caps uppercase tracking-wider border border-tertiary/30 rounded-lg bg-tertiary/5"
          >
            Registered
          </span>
        )}
      </div>
    </motion.div>
  );
}
