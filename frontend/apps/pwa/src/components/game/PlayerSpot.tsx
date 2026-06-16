import { motion } from 'framer-motion';
import { PlayerAvatar } from './PlayerAvatar';
import { CardBack, Card } from './Card';
import { TimerBar } from './TimerBar';
import { cn } from '@/lib/utils';

interface PlayerSpotProps {
  seat: {
    seat: number;
    user_id: string;
    display_name?: string;
    stack: number;
    current_bet: number;
    is_all_in: boolean;
    is_folded: boolean;
    is_active: boolean;
    avatar_url?: string;
    position_badge?: string;
    action?: {
      text: string;
      amount?: number;
    };
    hole_cards?: Array<{ rank: string; suit: string }>;
  };
  isHero?: boolean;
  isMobile?: boolean;
  isDealer?: boolean;
  seatPosition?: { left: string; top: string; transform: string };
  timerRemainingMs?: number | null;
}

export const PlayerSpot = ({
  seat,
  isHero = false,
  isMobile = false,
  isDealer = false,
  seatPosition,
  timerRemainingMs,
}: PlayerSpotProps) => {
  const {
    display_name = 'Player',
    stack,
    current_bet,
    is_all_in,
    is_folded,
    is_active,
    avatar_url,
    position_badge,
    action,
    hole_cards,
  } = seat;

  const isActive = is_active && !is_folded && !is_all_in;
  const isFolded = is_folded || is_all_in;

  // ── Badge placement (opposite edge based on hub position) ──
  const getBadgePlacement = (): React.CSSProperties => {
    if (!seatPosition) return { left: '50%', top: '-8px', transform: 'translateX(-50%)' };
    const topPercent = parseFloat(seatPosition.top);
    const isTopHalf = topPercent < 50;
    if (isTopHalf) {
      return { left: '50%', bottom: '-8px', transform: 'translateX(-50%)' };
    } else {
      return { left: '50%', top: '-8px', transform: 'translateX(-50%)' };
    }
  };

  const badgePlacement = getBadgePlacement();
  const isBadgeAbove = badgePlacement.top !== undefined;

  // ── Glass hub – less radius, compact width ──
  const glassClasses = cn(
    'relative rounded transition-all duration-200',
    isMobile ? 'p-1 w-[90px]' : 'p-2 w-[140px]',
    {
      'bg-black/70 backdrop-blur-md border border-white/10': true,
      'border-tertiary/40 shadow-[0_0_20px_rgba(78,222,163,0.15)]': isActive && !isHero,
      'border-tertiary shadow-[0_0_30px_rgba(78,222,163,0.25)]': isActive && isHero,
      'opacity-40 grayscale': isFolded,
    }
  );

  // ── Action pill ──
  const actionPillClasses = cn(
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border transition-all',
    isMobile ? 'text-[7px]' : 'text-[9px]',
    {
      'border-tertiary/30 text-tertiary bg-tertiary/5': action?.text === 'CHECK' || action?.text === 'CALL',
      'border-white/20 text-white bg-white/5': action?.text === 'RAISE' || action?.text === 'BET',
      'border-red-500/30 text-red-400 bg-red-500/5': action?.text === 'FOLD',
      'border-red-500/50 text-red-400 bg-red-500/10': action?.text === 'ALL-IN',
      'border-white/10 text-white/40 bg-transparent': !action,
    }
  );

  // ── Dealer button (top-left) ──
  const dealerButton = isDealer && !isHero && (
    <div className="absolute -top-2 -left-2 z-10 w-5 h-5 rounded-full bg-white text-black flex items-center justify-center font-bold text-[9px] shadow-lg border border-white/30">
      D
    </div>
  );

  // ── Position badge ──
  const positionTag = position_badge && !isHero && (
    <span className="ml-1 text-[8px] font-bold text-tertiary/60 uppercase tracking-wider">
      {position_badge}
    </span>
  );

  // ── Action pill (inside hub) ──
  const actionPill = action && (
    <div className="mt-1 flex justify-center">
      <span className={actionPillClasses}>
        {action.text}
        {action.amount !== undefined && (
          <span className="opacity-60 ml-0.5">${action.amount}</span>
        )}
      </span>
    </div>
  );

  // ── Card size ──
  const cardSize = isMobile ? 'w-5 h-8' : 'w-9 h-13';

  // ── Cards (fanned over top‑right corner) ──
  const renderCards = () => {
    if (isHero && hole_cards && hole_cards.length === 2) {
      return (
        <div className="flex -space-x-3">
          <Card rank={hole_cards[0].rank} suit={hole_cards[0].suit} className={cn(cardSize, '-rotate-[6deg]')} />
          <Card rank={hole_cards[1].rank} suit={hole_cards[1].suit} className={cn(cardSize, 'rotate-[6deg]')} />
        </div>
      );
    }
    return (
      <div className="flex -space-x-3">
        <CardBack className={cn(cardSize, '-rotate-[6deg]')} />
        <CardBack className={cn(cardSize, 'rotate-[6deg]')} />
      </div>
    );
  };

  // ── Avatar (hidden on mobile with animation) ──
  const avatarElement = (
    <motion.div
      initial={false}
      animate={{
        scale: isMobile ? 0 : 1,
        opacity: isMobile ? 0 : 1,
        width: isMobile ? 0 : 'auto',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.3 }}
      className={isMobile ? 'w-0 overflow-hidden' : ''}
    >
      <PlayerAvatar
        name={display_name}
        avatarUrl={avatar_url}
        isActive={isActive}
        size={isMobile ? 'w-5 h-5' : 'w-8 h-8'}
      />
    </motion.div>
  );

  // ── Bankroll – plain amount ──
  const bankrollElement = (
    <span className={cn(
      'font-mono text-tertiary whitespace-nowrap',
      isMobile ? 'text-[8px]' : 'text-[11px]'
    )}>
      ${stack.toLocaleString()}
    </span>
  );

  // ── Current bet badge ──
  const currentBetBadge = current_bet > 0 && !isFolded && (
    <div
      className="absolute z-30 whitespace-nowrap px-2 py-0.5 rounded-full bg-black/60 border border-tertiary/30 text-tertiary font-mono text-[8px] text-center shadow-lg"
      style={badgePlacement}
    >
      ${current_bet}
    </div>
  );

  return (
    <div className="relative inline-flex flex-col items-center">
      {/* Hub */}
      <div className={glassClasses}>
        {dealerButton}

        {/* Cards */}
        <div className={cn(
          'absolute -top-3 -right-3 z-20 pointer-events-none',
          isMobile && '-top-2 -right-2'
        )}>
          {renderCards()}
        </div>

        {/* Avatar + info */}
        <div className={cn(
          'flex items-center gap-2 pr-10',
          isMobile && isBadgeAbove && 'mt-1'
        )}>
          {avatarElement}
          <div className="flex flex-col leading-tight min-w-0">
            <span className={cn(
              'font-medium text-on-surface whitespace-nowrap',
              isMobile ? 'text-[8px]' : 'text-[11px] truncate overflow-hidden max-w-[80px]',
              isFolded && 'opacity-60'
            )}>
              {isMobile ? display_name.slice(0, 8) : display_name}
              {positionTag}
            </span>
            {bankrollElement}
          </div>
        </div>

        {/* Timer – only when this player is active and timer is set */}
        {timerRemainingMs !== null && timerRemainingMs !== undefined && (
          <div className="mt-1.5 w-full px-0.5">
            <TimerBar remainingMs={timerRemainingMs} isActive={true} />
          </div>
        )}

        {/* Action pill */}
        {actionPill}
      </div>

      {/* Current bet badge */}
      {currentBetBadge}
    </div>
  );
};
