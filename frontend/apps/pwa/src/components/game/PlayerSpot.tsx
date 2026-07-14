import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState, useEffect, useRef, memo } from 'react';
import type { CSSProperties } from 'react';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayerSpotBadge } from './PlayerSpotBadge';
import { CardBack, Card } from './Card';
import { TimerBar } from './TimerBar';
import { cn } from '@/lib/utils';
import { LogOut, DollarSign, TrendingUp, Swords, Check } from 'lucide-react';
import { RankTierBadge } from '@/components/game/RankTierBadge';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

// ─── Animated Counter Hook ──────────────────────────────────────────────────
function useAnimatedCounter(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    const from = valueRef.current;
    const to = target;

    if (from === to) return;

    const start = performance.now();
    let rafId: number;

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;

      setValue(current);
      valueRef.current = current;

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        valueRef.current = to;
        setValue(to);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return value;
}

// ─── Action Styles Mapping ─────────────────────────────────────────────────────
const getActionStyles = (text?: string) => {
  switch (text) {
    case 'FOLD': return { Icon: LogOut, color: 'rgba(248, 113, 113, 1)' };
    case 'CHECK': return { Icon: Check, color: 'rgba(78, 222, 163, 1)' };
    case 'CALL': return { Icon: DollarSign, color: 'rgba(78, 222, 163, 1)' };
    case 'BET':
    case 'RAISE': return { Icon: TrendingUp, color: 'rgba(255, 255, 255, 0.85)' };
    case 'ALL-IN': return { Icon: Swords, color: 'rgba(251, 191, 36, 1)' };
    default: return { Icon: null, color: 'rgba(78, 222, 163, 1)' };
  }
};

const getActionBadgeVariants = (text?: string) => {
  switch (text) {
    case 'FOLD':
      return {
        initial: { opacity: 0, y: -15, scale: 0.5, rotate: -10 },
        animate: { opacity: 1, y: 0, scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } },
        exit: { opacity: 0, y: 20, scale: 0.8, rotate: 15, transition: { duration: 0.3, ease: 'easeIn' } },
      };
    case 'CHECK':
      return {
        initial: { opacity: 0, y: 10, scale: 0.8 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 15 } },
        exit: { opacity: 0, y: -10, scale: 0.8, transition: { duration: 0.2 } },
      };
    case 'CALL':
      return {
        initial: { opacity: 0, x: -20, scale: 0.8 },
        animate: { opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } },
        exit: { opacity: 0, x: 20, scale: 0.8, transition: { duration: 0.2 } },
      };
    case 'BET':
    case 'RAISE':
      return {
        initial: { opacity: 0, y: 15, scale: 0.5 },
        animate: { opacity: 1, y: 0, scale: [1, 1.1, 1], transition: { duration: 0.4, ease: 'easeOut' } },
        exit: { opacity: 0, y: -15, scale: 0.8, transition: { duration: 0.2 } },
      };
    case 'ALL-IN':
      return {
        initial: { opacity: 0, scale: 0.2 },
        animate: { opacity: 1, scale: [1, 1.2, 1], transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
        exit: { opacity: 0, scale: 0.5, filter: 'blur(2px)', transition: { duration: 0.3, ease: 'easeIn' } },
      };
    default:
      return {
        initial: { opacity: 0, scale: 0.6 },
        animate: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 30 } },
        exit: { opacity: 0, scale: 0.6, transition: { duration: 0.2 } },
      };
  }
};

// ─── 3D Winner Overlay ──────────────────────────────────────────────────────
const WinnerOverlay = () => {
  const accent = 'rgba(78, 222, 163, ';

  const sparkles = [
    { x: 15, y: 25, delay: 0.1, dx: 8, dy: -6, scaleZ: 0.8 },
    { x: 75, y: 20, delay: 0.6, dx: -10, dy: 5, scaleZ: 1.2 },
    { x: 10, y: 70, delay: 1.1, dx: 6, dy: 8, scaleZ: 0.9 },
    { x: 82, y: 78, delay: 1.6, dx: -5, dy: -9, scaleZ: 1.1 },
    { x: 45, y: 12, delay: 0.3, dx: -7, dy: 4, scaleZ: 1.0 },
    { x: 55, y: 85, delay: 0.9, dx: 9, dy: -3, scaleZ: 0.7 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden rounded-sm pointer-events-none" style={{ perspective: '800px' }}>
      <motion.div
        className="absolute inset-0 rounded-sm"
        style={{ background: `radial-gradient(circle at center, ${accent}0.2) 0%, ${accent}0.05) 60%, transparent 100%)`, filter: 'blur(6px)' }}
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2.2, repeat: 2, repeatType: 'reverse', ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-0 rounded-sm border-2"
        style={{ borderColor: `${accent}0.6)` }}
        animate={{ scale: [1, 1.08, 1.15], opacity: [0.8, 0.3, 0], rotateX: [0, 5, 0], rotateY: [0, -5, 0] }}
        transition={{ duration: 1.8, repeat: 2, delay: 0.2, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute"
        style={{
          left: '50%', top: '50%', width: 40, height: 40, marginLeft: -20, marginTop: -20,
          border: `1.5px solid ${accent}0.5)`, transform: 'rotate(45deg)', boxShadow: `0 0 30px ${accent}0.2)`,
          background: `radial-gradient(circle at 30% 30%, ${accent}0.15) 0%, transparent 70%)`,
        }}
        animate={{ rotateX: [0, 360], rotateY: [0, 180], rotateZ: [0, 90], scale: [0.8, 1.2, 0.8], opacity: [0, 1, 0] }}
        transition={{ duration: 4, repeat: 2, ease: 'easeInOut' }}
      />
      {sparkles.map((s) => (
        <motion.div
          key={s.x}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ left: `${s.x}%`, top: `${s.y}%`, backgroundColor: '#4EDEA3', boxShadow: `0 0 12px ${accent}0.8), 0 0 24px ${accent}0.4)` }}
          animate={{ x: [0, s.dx, 0], y: [0, s.dy, 0], scale: [0.5, 1.8 * s.scaleZ, 0.5], opacity: [0, 1, 0], rotateX: [0, 180], rotateY: [0, 90] }}
          transition={{ duration: 3.5, repeat: 2, delay: s.delay, ease: 'easeInOut' }}
        />
      ))}
      <motion.div
        className="absolute inset-0 rounded-sm"
        style={{ background: `linear-gradient(135deg, transparent 35%, ${accent}0.12) 50%, transparent 65%)` }}
        animate={{ x: ['-120%', '120%'] }}
        transition={{ duration: 2.8, repeat: 2, ease: 'easeInOut' }}
      />
    </div>
  );
};

// ─── Shared Transition Constants & Static Styles ────────────────────────────
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const LAYOUT_TRANSITION = { duration: 0.45, ease: EASE_OUT };
const PERSPECTIVE_STYLE: CSSProperties = { perspective: '1000px' };
const CARD_3D_STYLE: CSSProperties = { transformStyle: 'preserve-3d', perspective: '1000px' };
const CARD_BACKFACE_STYLE: CSSProperties = { backfaceVisibility: 'hidden', transformOrigin: 'center' };

const containerVariants = {
  collapsed: { gap: 0 },
  fan: { gap: 4, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

// ─── CardGroup (Memoized) ──────────────────────────────────────────────────
const CardGroup = memo(({
  showCardsFaceUp, hole_cards, cardSize, sizeProp, isMobile, winningCards, isWinner, isShowdown, isHero, isDealing,
}: {
  showCardsFaceUp: boolean; hole_cards?: Array<{ rank: string; suit: string }>; cardSize: string; sizeProp: 'xs' | 'sm' | 'md'; isMobile: boolean; winningCards?: Array<{ rank: string; suit: string }>; isWinner?: boolean; isShowdown?: boolean; isHero?: boolean; isDealing?: boolean;
}) => {
  const leftCardVariants = useMemo(() => ({
    collapsed: { rotate: -6, x: isMobile ? 4 : 6 },
    fan: { rotate: -8, x: isMobile ? -3 : -4 },
    exit: {
      y: isHero ? -150 : 120,
      x: -60,
      rotate: -45,
      opacity: 0,
      transition: { duration: 0.4, ease: 'easeIn' as const }
    }
  }), [isMobile, isHero]);

  const rightCardVariants = useMemo(() => ({
    collapsed: { rotate: 6, x: isMobile ? -4 : -6 },
    fan: { rotate: 8, x: isMobile ? 3 : 4 },
    exit: {
      y: isHero ? -140 : 110,
      x: 50,
      rotate: 40,
      opacity: 0,
      transition: { duration: 0.4, ease: 'easeIn' as const, delay: 0.05 }
    }
  }), [isMobile, isHero]);

  const isWinningCard = (card?: { rank: string; suit: string }) => {
    if (!card) return false;
    return winningCards?.some((wc) => wc.rank === card.rank && wc.suit === card.suit);
  };

  const isCardLosing = (card?: { rank: string; suit: string }) => {
    if (!isShowdown) return false;
    if (isWinner) return !isWinningCard(card);
    return true;
  };

  if (isHero && isDealing) return null;

  const renderCard1 = (hole_cards && hole_cards.length > 0) ? (
    <AnimatePresence mode="popLayout">
      {showCardsFaceUp ? (
        <motion.div
          key="front1"
          initial={{ rotateY: -90 }}
          animate={{ rotateY: 0 }}
          exit={{ rotateY: -90 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
          style={CARD_BACKFACE_STYLE}
        >
          <Card rank={hole_cards[0].rank} suit={hole_cards[0].suit} className={cn(cardSize)} size={sizeProp} isWinning={isWinningCard(hole_cards[0])} isLosing={isCardLosing(hole_cards[0])} />
        </motion.div>
      ) : (
        <motion.div
          key="back1"
          initial={{ rotateY: 90 }}
          animate={{ rotateY: 0 }}
          exit={{ rotateY: 90 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
          style={CARD_BACKFACE_STYLE}
        >
          <CardBack className={cn(cardSize)} size={sizeProp} />
        </motion.div>
      )}
    </AnimatePresence>
  ) : (
    <CardBack className={cn(cardSize, '-rotate-[6deg]')} size={sizeProp} />
  );

  const renderCard2 = (hole_cards && hole_cards.length > 1) ? (
    <AnimatePresence mode="popLayout">
      {showCardsFaceUp ? (
        <motion.div
          key="front2"
          initial={{ rotateY: -90 }}
          animate={{ rotateY: 0 }}
          exit={{ rotateY: -90 }}
          transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.05 }}
          style={CARD_BACKFACE_STYLE}
        >
          <Card rank={hole_cards[1].rank} suit={hole_cards[1].suit} className={cn(cardSize)} size={sizeProp} isWinning={isWinningCard(hole_cards[1])} isLosing={isCardLosing(hole_cards[1])} />
        </motion.div>
      ) : (
        <motion.div
          key="back2"
          initial={{ rotateY: 90 }}
          animate={{ rotateY: 0 }}
          exit={{ rotateY: 90 }}
          transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.05 }}
          style={CARD_BACKFACE_STYLE}
        >
          <CardBack className={cn(cardSize)} size={sizeProp} />
        </motion.div>
      )}
    </AnimatePresence>
  ) : (
    <CardBack className={cn(cardSize, 'rotate-[6deg]')} size={sizeProp} />
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 1, scale: 1, rotate: 0, y: 0, x: 0 }}
      animate={{ opacity: 1, scale: 1, rotate: 0, y: 0, x: 0 }}
      className="flex items-center pointer-events-auto"
      style={{ transformOrigin: 'center' }}
      transition={{ layout: LAYOUT_TRANSITION }}
    >
      <motion.div className="flex items-center" variants={containerVariants} initial="collapsed" whileHover="fan" whileTap="fan">
        <motion.div
          variants={leftCardVariants}
          className="relative"
          style={CARD_3D_STYLE}
          initial="collapsed"
          animate="collapsed"
          exit="exit"
        >
          {renderCard1}
        </motion.div>
        <motion.div
          variants={rightCardVariants}
          className="relative"
          style={CARD_3D_STYLE}
          initial="collapsed"
          animate="collapsed"
          exit="exit"
        >
          {renderCard2}
        </motion.div>
      </motion.div>
    </motion.div>
  );
});
CardGroup.displayName = 'CardGroup';

// ─── Main PlayerSpot ──────────────────────────────────────────────────────
export const PlayerSpot = memo(({
  onKick,
  seat,
  isHero = false,
  isMobile = false,
  isDealer = false,
  seatPosition,
  timerRemainingMs,
  timerTotalMs,
  isDealing = false,
  onShowStats,
}: any) => {
  const {
    display_name = seat.user_id?.slice(0, 8) || t`Player`,
    stack,
    current_bet,
    is_all_in,
    is_folded,
    is_active,
    avatar_url,
    position_badge,
    action,
    hole_cards,
    winning_cards,
    is_winner,
    is_showdown_revealed,
    stats,
    rank_tier,
  } = seat;

  const isActive = is_active && !is_folded && !is_all_in;
  const isFolded = is_folded;

  const showCardsFaceUp = isHero || (is_showdown_revealed && (hole_cards?.length ?? 0) > 0);
  const isLargeCards = isHero || showCardsFaceUp;

  const isLosingPlayer = is_showdown_revealed && !is_winner;

  const getBadgePlacement = (): CSSProperties => {
    if (isHero) {
      return { left: '0px', top: '0px' };
    }
    return { left: '50%', bottom: '-6px' };
  };

  const badgePlacement = getBadgePlacement();

  const oppHubWidth = isMobile ? 'w-[26vw] max-w-[100px]' : 'w-[120px]';
  const oppHubPadding = isMobile ? 'p-[4px]' : 'p-1.5';
  const oppCardSize = isMobile ? 'w-[16px] h-[22px]' : 'w-[28px] h-[40px]';
  const oppSizeProp = isMobile ? 'xs' : 'sm';

  const heroHubWidth = isMobile ? 'w-[40vw] max-w-[140px]' : 'w-[160px]';
  const heroHubPadding = isMobile ? 'p-[8px]' : 'p-2.5';
  const heroCardSize = isMobile ? 'w-[48px] h-[64px]' : 'w-12 h-16';
  const heroSizeProp = isMobile ? 'sm' : 'md';

  const hubWidth = isHero ? heroHubWidth : oppHubWidth;
  const hubPadding = isHero ? heroHubPadding : oppHubPadding;
  const cardSize = isLargeCards ? heroCardSize : oppCardSize;
  const sizeProp = isLargeCards ? heroSizeProp : oppSizeProp;

  const glassClasses = cn(
    'relative rounded-sm transition-all duration-300 overflow-visible font-mono transform-gpu [will-change:transform]',
    hubPadding, hubWidth,
    {
      'bg-[rgba(8,8,8,0.85)] backdrop-blur-md border border-white/10': true,
      'border-tertiary/40 shadow-[0_0_20px_rgba(78,222,163,0.15)]': isActive && !isHero,
      'border-tertiary/60 shadow-[0_0_25px_rgba(78,222,163,0.15)]': isActive && isHero,
      'border-tertiary/70 shadow-[0_0_30px_rgba(78,222,163,0.35)]': is_winner,
      'opacity-30 grayscale': isFolded,
      'opacity-50 grayscale': isLosingPlayer,
    }
  );

  const isLeftSide = seatPosition && parseFloat(seatPosition.left) < 40;

  const dealerButton = isDealer && (
    <motion.div
      layoutId="dealer-button"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        'absolute z-[110] rounded-full flex items-center justify-center font-bold pointer-events-none border border-gray-400/80 overflow-hidden leading-none',
        'bg-gradient-to-br from-white to-gray-400 text-black',
        'shadow-[0_3px_6px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(0,0,0,0.2)]',
        isMobile
          ? (isLeftSide ? '-bottom-3 -right-4 w-5 h-5 text-[8px]' : '-bottom-3 -left-4 w-5 h-5 text-[8px]')
          : (isLeftSide ? '-bottom-2 -right-2 w-5 h-5 text-[9px]' : '-bottom-2 -left-2 w-5 h-5 text-[9px]')
      )}
    >
      <span className="relative z-10"><Trans>D</Trans></span>
      <motion.div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.8) 50%, transparent 70%)' }}
        initial={{ x: '-150%' }}
        animate={{ x: '150%' }}
        transition={{
          duration: 0.6,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatDelay: Math.random() * 4 + 2,
        }}
      />
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
            'shrink-0 inline-flex items-center justify-center font-mono font-bold uppercase leading-none',
            'h-[16px] px-1.5 rounded-[3px]',
            isMobile ? 'text-[7px]' : 'text-[8px]',
            'text-tertiary bg-tertiary/10 border border-tertiary/30 backdrop-blur-sm',
            'shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]'
          )}
        >
          {position_badge}
        </motion.span>
      )}
    </AnimatePresence>
  );

  const avatarElement = (
    <motion.div
      initial={false}
      animate={{ scale: isMobile ? 0 : 1, opacity: isMobile ? 0 : 1, width: isMobile ? 0 : 'auto' }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.3 }}
      className={isMobile ? 'w-0 overflow-hidden' : ''}
    >
      <PlayerAvatar name={display_name} avatarUrl={avatar_url} isActive={isActive} size={isMobile ? 'w-4 h-4' : 'w-8 h-8'} />
    </motion.div>
  );

  const safeStack = typeof stack === 'number' ? stack : 0;
  const formattedStack = safeStack >= 1000 ? `$${(safeStack / 1000).toFixed(safeStack % 1000 === 0 ? 0 : 1)}k` : `$${safeStack}`;

  const bankrollElement = (
    <span className={cn(
      'font-mono whitespace-nowrap font-bold bg-gradient-to-b from-zinc-200 to-zinc-400 text-transparent bg-clip-text truncate leading-none',
      isMobile ? 'text-[10px]' : 'text-[11px]'
    )}>
      {formattedStack}
    </span>
  );

  // ─── Animated Stats ──────────────────────────────────────────────────────
  const rawVpip = stats?.vpip ?? 0;
  const rawPfr = stats?.pfr ?? 0;
  const rawAf = stats?.aggression_factor ?? 0;

  const animatedVpip = useAnimatedCounter(rawVpip * 100, 600);
  const animatedPfr = useAnimatedCounter(rawPfr * 100, 600);
  const animatedAf = useAnimatedCounter(rawAf, 600);

  const prevStatsRef = useRef({ vpip: rawVpip, pfr: rawPfr, af: rawAf });
  const [flashColors, setFlashColors] = useState<{ vpip?: string; pfr?: string; af?: string }>({});

  useEffect(() => {
    const prev = prevStatsRef.current;
    const newV = rawVpip;
    const newP = rawPfr;
    const newA = rawAf;

    const updates: typeof flashColors = {};
    if (newV !== prev.vpip) {
      updates.vpip = newV > prev.vpip ? 'text-green-400' : 'text-red-400';
    }
    if (newP !== prev.pfr) {
      updates.pfr = newP > prev.pfr ? 'text-green-400' : 'text-red-400';
    }
    if (newA !== prev.af) {
      updates.af = newA > prev.af ? 'text-green-400' : 'text-red-400';
    }

    if (Object.keys(updates).length > 0) {
      setFlashColors(updates);
      const timer = setTimeout(() => setFlashColors({}), 1500);
      return () => clearTimeout(timer);
    }
    prevStatsRef.current = { vpip: newV, pfr: newP, af: newA };
  }, [rawVpip, rawPfr, rawAf]);

  const statsElement = useMemo(() => {
    if (!stats) return null;

    const vpipDisplay = Math.round(animatedVpip);
    const pfrDisplay = Math.round(animatedPfr);
    const afDisplay = animatedAf.toFixed(1);

    const textSize = isMobile ? 'text-[7px]' : 'text-[7px]';
    const baseStyle = 'text-on-surface-variant/70 truncate';

    return (
      <div className={cn('flex items-baseline h-[8px] overflow-hidden leading-none gap-[2px]', baseStyle, textSize)}>
        <span className="shrink-0">V</span>
        <span className={cn('shrink-0 inline-block min-w-[14px] text-right tabular-nums transition-colors duration-500', flashColors.vpip || 'text-on-surface-variant')}>
          {vpipDisplay}
        </span>
        <span className="shrink-0">/P</span>
        <span className={cn('shrink-0 inline-block min-w-[14px] text-right tabular-nums transition-colors duration-500', flashColors.pfr || 'text-on-surface-variant')}>
          {pfrDisplay}
        </span>
        <span className="shrink-0">/A</span>
        <span className={cn('shrink-0 inline-block min-w-[18px] text-right tabular-nums transition-colors duration-500', flashColors.af || 'text-on-surface-variant')}>
          {afDisplay}
        </span>
      </div>
    );
  }, [animatedVpip, animatedPfr, animatedAf, rawVpip, rawPfr, rawAf, flashColors, isMobile, stats]);

  const hasTimer = timerRemainingMs !== null && timerRemainingMs !== undefined;

  const winnerOverlay = is_winner && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0 z-10">
      <WinnerOverlay />
    </motion.div>
  );

  const allInGlow = is_all_in && !is_folded ? (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 0.8, repeat: 2, repeatType: 'reverse' }} className="absolute inset-0 rounded-sm pointer-events-none" style={{ boxShadow: '0 0 15px rgba(239,68,68,0.3), 0 0 30px rgba(239,68,68,0.15)' }} />
  ) : null;

  const isCardAreaCentered = !isHero;

  const cardYOffset = (() => {
    if (isHero) return -56;
    if (showCardsFaceUp) return isMobile ? -54 : -56;
    return isMobile ? -20 : -34;
  })();

  const cardPositionStyle: CSSProperties = (() => {
    if (isHero) return { right: isMobile ? -20 : -10, left: 'auto', top: 0 };
    return { left: '50%', top: 0 };
  })();

  const actionInfo = getActionStyles(action?.text);
  const showActionBadge = (action || current_bet > 0) && !seat.is_showdown_revealed;
  const badgeVariants = getActionBadgeVariants(action?.text);

  return (
    <div
      className={cn('relative inline-flex flex-col items-center', isHero ? 'z-[455]' : 'z-20')}
      style={PERSPECTIVE_STYLE}
    >
      <motion.div
        className={cn(glassClasses, 'relative z-20')}
        data-hub
        animate={
          is_winner
            ? {
              scale: [1, 1.03, 1],
              rotateX: [0, 2, 0],
              rotateY: [0, -3, 0],
              boxShadow: [
                '0 0 10px rgba(78,222,163,0.2)',
                '0 0 30px rgba(78,222,163,0.5)',
                '0 0 10px rgba(78,222,163,0.2)',
              ],
            }
            : { scale: 1, rotateX: 0, rotateY: 0 }
        }
        transition={
          is_winner
            ? { duration: 2.5, repeat: 2, ease: [0.22, 1, 0.36, 1] }
            : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
        }
      >
        {winnerOverlay}
        {allInGlow}

        {onShowStats && (
          <button
            type="button"
            onClick={() => onShowStats(seat.user_id)}
            className="absolute inset-0 w-full h-full z-[60] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 rounded-sm"
            aria-label={t`Show stats for ${display_name}`}
          />
        )}

        <div className="flex flex-col w-full gap-0.5">
          <div className={cn('flex items-center gap-1', isMobile ? 'gap-1' : 'gap-2')}>
            {avatarElement}
            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
              <div className="flex items-center gap-1 min-w-0">
                <span className={cn(
                  'font-mono font-medium text-on-surface whitespace-nowrap truncate leading-none',
                  isMobile ? 'text-[11px]' : 'text-[11px]',
                  isFolded && 'opacity-60'
                )}>
                  {display_name}
                </span>
                {rank_tier && (
                  <RankTierBadge tier={rank_tier} size="sm" showLabel={false} className="ml-0.5" />
                )}
                <PlayerSpotBadge userId={seat.user_id} badges={seat.badges} showBadges={true} />
                {positionTag}
              </div>
              <div className="flex items-center gap-1 min-w-0">
                {bankrollElement}
              </div>
              {statsElement}
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
              <TimerBar remainingMs={timerRemainingMs!} totalMs={timerTotalMs ?? null} isActive={true} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {!isDealing && !isFolded && (
          <motion.div
            key={`card-area-${seat.seat}`}
            initial={{ opacity: 0, scale: 0.85, x: isCardAreaCentered ? '-50%' : 0, y: cardYOffset }}
            animate={{ opacity: 1, scale: 1, x: isCardAreaCentered ? '-50%' : 0, y: cardYOffset }}
            exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeIn' } }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="absolute z-40"
            style={cardPositionStyle}
          >
            <CardGroup
              key={`hole-${seat.seat}`}
              showCardsFaceUp={showCardsFaceUp}
              hole_cards={hole_cards}
              cardSize={cardSize}
              sizeProp={sizeProp}
              isMobile={isMobile}
              winningCards={winning_cards}
              isWinner={is_winner}
              isShowdown={is_showdown_revealed}
              isHero={isHero}
              isDealing={isDealing}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {dealerButton}

      {/* Kick vote button - only visible if player is sitting out and not self */}
      {!isHero && seat.sitting_out && onKick && (
        <button
          onClick={() => onKick(seat.user_id)}
          className="absolute -bottom-1 right-0 z-[60] p-1 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-300 text-[10px] transition-colors"
          title={t`Kick player`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div
        className="absolute z-[100] pointer-events-none"
        style={{
          ...badgePlacement,
          transform: isHero ? 'translate(-50%, -50%)' : 'translate(-50%, 50%)'
        }}
      >
        <AnimatePresence mode="wait">
          {showActionBadge && (
            <motion.div
              key={`${action?.text}-${current_bet}`}
              variants={badgeVariants as any}
              initial="initial"
              animate="animate"
              exit="exit"
              className={cn(
                'whitespace-nowrap px-1.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md border font-mono text-center shadow-lg flex items-center justify-center gap-1 leading-none',
                isMobile ? 'text-[10px]' : 'text-[8px]'
              )}
              style={{
                transformOrigin: 'center',
                borderColor: actionInfo.color + '50',
                color: actionInfo.color,
              }}
            >
              {actionInfo.Icon && <actionInfo.Icon className="w-2.5 h-2.5 shrink-0" />}
              {action?.text && <span className="font-bold uppercase">{action.text}</span>}
              {!isFolded && current_bet > 0 && <span className="opacity-80 font-bold">${current_bet}</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {seat.is_showdown_revealed && seat.hand_description && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className={cn(
              'absolute -bottom-6 whitespace-nowrap font-mono uppercase px-1.5 py-0.5 rounded-md z-[100] shadow-lg leading-none',
              isMobile ? 'text-[8px]' : 'text-[8px]',
              is_winner ? 'bg-tertiary/20 text-tertiary border border-tertiary/40' : 'bg-black/80 text-on-surface-variant border border-white/5'
            )}
          >{seat.hand_description}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

PlayerSpot.displayName = 'PlayerSpot';
