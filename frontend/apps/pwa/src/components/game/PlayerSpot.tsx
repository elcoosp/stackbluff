import { motion, AnimatePresence } from 'framer-motion';
import type { CSSProperties } from 'react';
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
    is_winner?: boolean;
    is_showdown_revealed?: boolean;
    hand_description?: string;
  };
  isHero?: boolean;
  isMobile?: boolean;
  isDealer?: boolean;
  seatPosition?: { left: string; top: string; transform: string };
  timerRemainingMs?: number | null;
  timerTotalMs?: number | null;
}

export const PlayerSpot = ({
  seat,
  isHero = false,
  isMobile = false,
  isDealer = false,
  seatPosition,
  timerRemainingMs,
  timerTotalMs,
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

  const showCardsFaceUp = isHero || seat.is_showdown_revealed;
  const isLargeCards = isHero || showCardsFaceUp;

  const getBadgePlacement = (): CSSProperties => {
    if (!seatPosition) return { left: '50%', top: '-8px', transform: 'translateX(-50%)' };
    if (isHero) {
      return {
        left: isMobile ? '-8px' : '-12px',
        top: isMobile ? '-6px' : '-8px',
        transform: 'translateX(0)'
      };
    }
    const topPercent = parseFloat(seatPosition.top);
    const isTopHalf = topPercent < 50;
    if (isTopHalf) {
      return {
        left: '50%',
        bottom: isMobile ? '-6px' : '-8px',
        transform: 'translateX(-50%)'
      };
    } else {
      return {
        left: '50%',
        top: isMobile ? '-6px' : '-8px',
        transform: 'translateX(-50%)'
      };
    }
  };

  const badgePlacement = getBadgePlacement();
  const isBadgeAbove = badgePlacement.top !== undefined && !isHero;

  const oppHubWidth = isMobile ? 'w-[56px]' : 'w-[120px]';
  const oppHubPadding = isMobile ? 'p-[3px]' : 'p-1.5';
  const oppCardSize = isMobile ? 'w-[11px] h-[16px]' : 'w-[28px] h-[40px]';
  const oppSizeProp = isMobile ? 'xs' : 'sm';

  const heroHubWidth = isMobile ? 'w-[72px]' : 'w-[160px]';
  const heroHubPadding = isMobile ? 'p-[4px]' : 'p-2.5';
  const heroCardSize = isMobile ? 'w-9 h-12' : 'w-12 h-16';
  const heroSizeProp = isMobile ? 'sm' : 'md';

  const hubWidth = isHero ? heroHubWidth : oppHubWidth;
  const hubPadding = isHero ? heroHubPadding : oppHubPadding;

  const cardSize = isLargeCards ? heroCardSize : oppCardSize;
  const sizeProp = isLargeCards ? heroSizeProp : oppSizeProp;

  const cardTop = isLargeCards
    ? (isMobile ? '-top-11' : '-top-14')
    : (isMobile ? '-top-3' : '-top-9');

  const cardRight = isLargeCards
    ? (isMobile ? '-right-4' : '-right-10')
    : (isMobile ? '-right-1.5' : '-right-4');

  const infoPr = isHero ? (isMobile ? 'pr-2' : 'pr-4') : (isMobile ? 'pr-1.5' : 'pr-0');

  const glassClasses = cn(
    'relative rounded-sm transition-all duration-300 overflow-visible font-mono',
    hubPadding,
    hubWidth,
    {
      'bg-[rgba(8,8,8,0.85)] backdrop-blur-md border border-white/10': true,
      'border-tertiary/40 shadow-[0_0_20px_rgba(78,222,163,0.15)]': isActive && !isHero,
      'border-tertiary shadow-[0_0_30px_rgba(78,222,163,0.25)]': isActive && isHero,
      'border-tertiary/60 shadow-[0_0_25px_rgba(78,222,163,0.3)]': seat.is_winner,
      'opacity-30 grayscale': isFolded,
      'opacity-50 grayscale': seat.is_showdown_revealed && !seat.is_winner,
    }
  );

  const actionPillClasses = cn(
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border transition-all',
    isMobile ? 'text-[6px]' : 'text-[9px]',
    {
      'border-tertiary/30 text-tertiary bg-tertiary/5': action?.text === 'CHECK' || action?.text === 'CALL',
      'border-white/20 text-white bg-white/5': action?.text === 'RAISE' || action?.text === 'BET',
      'border-red-500/30 text-red-400 bg-red-500/5': action?.text === 'FOLD',
      'border-red-500/50 text-red-400 bg-red-500/10': action?.text === 'ALL-IN',
      'border-white/10 text-white/40 bg-transparent': !action,
    }
  );

  // ── Dealer button (Shared Layout Transition) ──
  // Removed AnimatePresence so Framer Motion can morph it directly between seats
  const dealerButton = isDealer && (
    <motion.div
      layoutId="dealer-button"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        "absolute z-[110] rounded-full flex items-center justify-center font-bold pointer-events-none border border-gray-400/80",
        "bg-gradient-to-br from-white to-gray-400 text-black",
        "shadow-[0_3px_6px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(0,0,0,0.2)]",
        isMobile ? "-bottom-1.5 -left-1.5 w-3.5 h-3.5 text-[6px]" : "-bottom-2 -left-2 w-5 h-5 text-[9px]"
      )}
    >
      D
    </motion.div>
  );

  const positionTag = (
    <AnimatePresence>
      {position_badge && (
        <motion.span
          key={position_badge}
          initial={{ opacity: 0, scale: 0.5, x: -5 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.5, x: -5 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn(
            "font-bold text-tertiary uppercase tracking-wider rounded px-1 py-px flex items-center justify-center bg-tertiary/25 shrink-0",
            isMobile ? "text-[5px]" : "text-[7px]"
          )}
        >
          {position_badge}
        </motion.span>
      )}
    </AnimatePresence>
  );

  const actionPill = action && (
    <div className={cn('flex justify-center', isMobile ? 'mt-0.5' : 'mt-1.5')}>
      <span className={actionPillClasses}>
        {action.text}
        {action.amount !== undefined && (
          <span className="opacity-60 ml-0.5">${action.amount}</span>
        )}
      </span>
    </div>
  );

  const containerVariants = {
    collapsed: { gap: 0 },
    fan: { gap: isMobile ? 2 : 4, transition: { duration: 0.25, ease: 'easeOut' as const } },
  };

  const leftCardVariants = {
    collapsed: { rotate: -6, x: isMobile ? 2 : 6 },
    fan: { rotate: -8, x: isMobile ? -1 : -4 },
  };

  const rightCardVariants = {
    collapsed: { rotate: 6, x: isMobile ? -2 : -6 },
    fan: { rotate: 8, x: isMobile ? 1 : 4 },
  };

  const renderCards = () => {
    if (!hole_cards || hole_cards.length === 0) {
      return (
        <div className={cn('flex transition-all duration-300', isMobile ? '-space-x-1' : '-space-x-3')}>
          <CardBack className={cn(cardSize, '-rotate-[6deg] transition-all duration-300')} size={sizeProp} />
          <CardBack className={cn(cardSize, 'rotate-[6deg] transition-all duration-300')} size={sizeProp} />
        </div>
      );
    }

    return (
      <motion.div
        className="flex items-center pointer-events-auto"
        variants={containerVariants}
        initial="collapsed"
        whileHover="fan"
        whileTap="fan"
      >
        <motion.div variants={leftCardVariants} className="relative" style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <AnimatePresence mode="wait">
            {showCardsFaceUp ? (
              <motion.div
                key="front1"
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ backfaceVisibility: 'hidden' }}
              >
                <Card rank={hole_cards[0].rank} suit={hole_cards[0].suit} className={cn(cardSize, 'shadow-xl transition-all duration-300 ease-in-out')} size={sizeProp} />
              </motion.div>
            ) : (
              <motion.div
                key="back1"
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ backfaceVisibility: 'hidden' }}
              >
                <CardBack className={cn(cardSize, 'shadow-xl transition-all duration-300 ease-in-out')} size={sizeProp} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={rightCardVariants} className="relative" style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <AnimatePresence mode="wait">
            {showCardsFaceUp ? (
              <motion.div
                key="front2"
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                style={{ backfaceVisibility: 'hidden' }}
              >
                <Card rank={hole_cards[1].rank} suit={hole_cards[1].suit} className={cn(cardSize, 'shadow-xl transition-all duration-300 ease-in-out')} size={sizeProp} />
              </motion.div>
            ) : (
              <motion.div
                key="back2"
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                style={{ backfaceVisibility: 'hidden' }}
              >
                <CardBack className={cn(cardSize, 'shadow-xl transition-all duration-300 ease-in-out')} size={sizeProp} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    );
  };

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
        size={isMobile ? 'w-4 h-4' : 'w-8 h-8'}
      />
    </motion.div>
  );

  const formattedStack = stack >= 1000
    ? `$${(stack / 1000).toFixed(stack % 1000 === 0 ? 0 : 1)}k`
    : `$${stack}`;

  const bankrollElement = (
    <span className={cn(
      'font-mono whitespace-nowrap font-bold bg-gradient-to-b from-zinc-200 to-zinc-400 text-transparent bg-clip-text truncate',
      isMobile ? 'text-[6px]' : 'text-[11px]'
    )}>
      {formattedStack}
    </span>
  );

  const hasTimer = timerRemainingMs !== null && timerRemainingMs !== undefined;

  return (
    <div className="relative inline-flex flex-col items-center">
      <div className={cn(glassClasses, 'relative z-20')}>
        <div className={cn('flex items-center', isMobile ? 'gap-0.5' : 'gap-2', infoPr, isMobile && isBadgeAbove && 'mt-0.5')}>
          {avatarElement}
          <div className="flex flex-col leading-tight min-w-0 w-full">
            <span className={cn(
              'font-mono font-medium text-on-surface whitespace-nowrap truncate',
              isMobile ? 'text-[6px]' : 'text-[11px]',
              isFolded && 'opacity-60'
            )}>
              {isMobile ? display_name.slice(0, 8) : display_name}
            </span>

            <div className="flex items-center gap-1 min-w-0">
              {bankrollElement}
              {positionTag}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {hasTimer && (
            <motion.div
              key="timer"
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: isMobile ? 2 : 6 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="w-full px-0.5 overflow-hidden"
            >
              <TimerBar
                remainingMs={timerRemainingMs!}
                totalMs={timerTotalMs ?? null}
                isActive={true}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {actionPill}
      </div>

      <div className={cn('absolute z-40 transition-all duration-300 ease-in-out', cardTop, cardRight)}>
        {renderCards()}
      </div>

      {/* Dealer Button (Shared Layout Transition) */}
      {dealerButton}

      <AnimatePresence mode="popLayout" initial={false}>
        {current_bet > 0 && !isFolded && !seat.is_showdown_revealed && (
          <motion.div
            key={current_bet}
            initial={{ opacity: 0, y: -8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={cn(
              "absolute z-[100] whitespace-nowrap px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-tertiary font-mono text-center shadow-lg",
              isMobile ? "text-[5px]" : "text-[8px]"
            )}
            style={badgePlacement}
          >
            ${current_bet}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {seat.is_showdown_revealed && seat.hand_description && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className={cn(
              "absolute -bottom-4 whitespace-nowrap text-[6px] font-mono uppercase tracking-wider px-1 py-0.5 rounded z-[100]",
              seat.is_winner
                ? 'bg-tertiary/20 text-tertiary border border-tertiary/40'
                : 'bg-black/80 text-on-surface-variant border border-white/5'
            )}
          >
            {seat.hand_description}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
