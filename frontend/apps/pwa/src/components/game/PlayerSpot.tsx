import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { TimerBar } from './TimerBar';
import { RazorDivider } from './RazorDivider';
import { Badge } from './Badge';
import { ChipStack } from './ChipStack';
import { PlayerSpotBadge } from './PlayerSpotBadge';
import { useFeedback } from '@stackbluff/shared/hooks/useFeedback';

interface PlayerSpotProps {
  seat: any;
  isHero: boolean;
  isMobile: boolean;
  isDealer: boolean;
  seatPosition: any;
  timerRemainingMs: number | null;
  timerTotalMs: number | null;
  isDealing: boolean;
  onShowStats: (userId: string) => void;
}

export function PlayerSpot({
  seat,
  isHero,
  isMobile,
  isDealer,
  seatPosition,
  timerRemainingMs,
  timerTotalMs,
  isDealing,
  onShowStats,
}: PlayerSpotProps) {
  const { trigger } = useFeedback();
  const [showHoleCards, setShowHoleCards] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isFolded = seat.is_folded;
  const isAllIn = seat.is_all_in;
  const isWinner = seat.is_winner;
  const isLeaving = seat.is_leaving;
  const sittingOut = seat.sitting_out;
  const stack = seat.stack || 0;
  const currentBet = seat.current_bet || 0;
  const displayName = seat.display_name || 'Player';
  const avatarUrl = seat.avatar_url;
  const holeCards = seat.hole_cards;
  const isShowdownRevealed = seat.is_showdown_revealed;
  const winningCards = seat.winningCards;
  const handDescription = seat.hand_description;
  const winAmount = seat.win_amount;

  const isActive = !isFolded && !isAllIn && !isLeaving && !sittingOut;
  const isCurrentTurn = seat.user_id === seat.currentTurnUserId;

  // For time bank: show when timerRemainingMs < 10s
  const showTimeBank = isHero && timerRemainingMs !== null && timerRemainingMs < 10000;

  useEffect(() => {
    if (isHero && isCurrentTurn) {
      trigger('notification', { seatIndex: seat.seat });
    }
  }, [isHero, isCurrentTurn, trigger, seat.seat]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(true);
    // Show hole cards after 0.5s hover if not folded
    if (!isFolded && holeCards && holeCards.length === 2) {
      timeoutRef.current = setTimeout(() => setShowHoleCards(true), 500);
    }
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(false);
    setShowHoleCards(false);
  };

  const handleClick = () => {
    if (seat.user_id) {
      onShowStats(seat.user_id);
    }
  };

  // Determine if this player has hole cards to show
  const hasHoleCards = holeCards && holeCards.length === 2;
  const showHoleCardsNow = (isHero || isShowdownRevealed || (isHovered && !isFolded)) && hasHoleCards;

  // Get position badge
  const positionBadge = seat.position_badge;

  // Determine if the player is all-in with a win
  const isAllInWinner = isAllIn && isWinner;

  return (
    <motion.div
      className={cn(
        'relative flex flex-col items-center transition-all duration-200',
        isMobile ? 'scale-[0.85]' : 'scale-100'
      )}
      style={{
        transform: seatPosition?.transform || '',
        pointerEvents: 'auto',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      whileHover={{ scale: isMobile ? 0.9 : 1.05 }}
      transition={{ duration: 0.15 }}
    >
      {/* Avatar container */}
      <div className="relative flex flex-col items-center">
        {/* Dealer badge */}
        {isDealer && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
            <Badge variant="dealer">D</Badge>
          </div>
        )}

        {/* Position badge */}
        {positionBadge && !isDealer && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
            <Badge variant="co">{positionBadge}</Badge>
          </div>
        )}

        {/* Avatar */}
        <div className="relative">
          <Avatar
            className={cn(
              'border-2 transition-all duration-200',
              isHero ? 'border-tertiary ring-2 ring-tertiary/30' : 'border-white/10',
              isWinner && !isHero ? 'border-yellow-400 ring-2 ring-yellow-400/30' : '',
              isFolded || isLeaving ? 'opacity-40 grayscale' : '',
              sittingOut ? 'opacity-50 grayscale' : '',
              isAllInWinner ? 'border-yellow-400 ring-4 ring-yellow-400/50' : '',
              isCurrentTurn ? 'border-tertiary shadow-[0_0_20px_rgba(78,222,163,0.3)]' : '',
              isMobile ? 'w-12 h-12' : 'w-14 h-14'
            )}
          >
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-surface-container text-on-surface text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Sitting out badge */}
          {sittingOut && (
            <div className="absolute -bottom-1 -right-1 bg-yellow-500/80 rounded-full p-0.5 text-[8px] font-bold text-black">
              AWAY
            </div>
          )}

          {/* All-in indicator */}
          {isAllIn && !isFolded && (
            <div className="absolute -bottom-1 -right-1 bg-red-500/80 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white">
              ALL-IN
            </div>
          )}
        </div>

        {/* Player info */}
        <div className="mt-1.5 text-center">
          <div className="flex items-center justify-center gap-1">
            <span
              className={cn(
                'font-medium truncate max-w-[60px]',
                isHero ? 'text-tertiary' : 'text-on-surface',
                isFolded || isLeaving ? 'text-on-surface-variant/40' : '',
                sittingOut ? 'text-on-surface-variant/40' : '',
                isMobile ? 'text-[10px]' : 'text-xs'
              )}
            >
              {isHero ? 'You' : displayName}
            </span>
            <PlayerSpotBadge userId={seat.user_id} />
          </div>

          {/* Stack */}
          <div className="flex items-center justify-center gap-1">
            <ChipStack amount={stack} size={isMobile ? 'text-[8px]' : 'text-[10px]'} />

            {/* Time bank display (only for hero) */}
            {showTimeBank && (
              <span className="ml-1 text-[10px] font-mono text-yellow-400 tabular-nums">
                ⏱{Math.ceil(timerRemainingMs / 1000)}s
              </span>
            )}
          </div>

          {/* Current bet */}
          {currentBet > 0 && !isFolded && (
            <div className="text-[8px] font-mono text-tertiary/70 mt-0.5">
              ${currentBet.toLocaleString()}
            </div>
          )}

          {/* Hand description (showdown) */}
          {isShowdownRevealed && handDescription && (
            <div className="mt-1 text-[8px] font-mono text-yellow-400/70 truncate max-w-[60px]">
              {handDescription}
            </div>
          )}

          {/* Win amount */}
          {isWinner && winAmount > 0 && (
            <div className="mt-0.5 text-[8px] font-mono text-green-400 font-bold">
              +${winAmount.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Timer bar (for current turn) */}
      {isCurrentTurn && timerRemainingMs !== null && timerTotalMs !== null && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-16">
          <TimerBar
            remainingMs={timerRemainingMs}
            totalMs={timerTotalMs}
            isActive={true}
            className="h-1"
          />
        </div>
      )}

      {/* Hole cards popup (on hover) */}
      <AnimatePresence>
        {showHoleCardsNow && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 bg-black/90 backdrop-blur-sm rounded-md px-2 py-1 border border-white/10 flex gap-1"
          >
            {holeCards.map((card: any, idx: number) => {
              const isWinning = winningCards?.some((wc: any) => wc.rank === card.rank && wc.suit === card.suit);
              return (
                <div
                  key={idx}
                  className={cn(
                    'w-6 h-8 rounded-sm flex items-center justify-center text-[10px] font-bold',
                    isWinning ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-white'
                  )}
                  style={{
                    color: card.suit === '♥' || card.suit === '♦' ? '#e11d48' : '#1e293b',
                  }}
                >
                  {card.rank}{card.suit}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status indicator - folded */}
      {isFolded && !isLeaving && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] font-mono text-red-400/60 bg-black/50 px-2 py-0.5 rounded">
            FOLDED
          </span>
        </div>
      )}

      {/* Status indicator - leaving */}
      {isLeaving && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] font-mono text-yellow-400/60 bg-black/50 px-2 py-0.5 rounded">
            LEAVING
          </span>
        </div>
      )}

      {/* Winning glow */}
      {isWinner && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          animate={{
            boxShadow: [
              '0 0 20px rgba(78,222,163,0.3)',
              '0 0 40px rgba(78,222,163,0.6)',
              '0 0 20px rgba(78,222,163,0.3)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.div>
  );
}
