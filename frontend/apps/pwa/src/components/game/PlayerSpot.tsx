import { PlayerAvatar } from './PlayerAvatar';
import { ChipStack } from './ChipStack';
import { Badge } from './Badge';
import { CardBack, Card } from './Card';

const glassBase: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderTopColor: 'rgba(255,255,255,0.18)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
};

const glassActive: React.CSSProperties = {
  background: 'rgba(78, 222, 163, 0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(78,222,163,0.4)',
  borderTopColor: 'rgba(78,222,163,0.5)',
  boxShadow: '0 0 20px rgba(78,222,163,0.25), 0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
};

export const PlayerSpot = ({
  seat,
  isHero,
  isMobile,
}: {
  seat: any;
  isHero?: boolean;
  isMobile?: boolean;
}) => {
  const isActive = seat.is_active;
  const displayName = seat.display_name || 'Player';
  const scale = isHero ? (isMobile ? 'scale-105' : 'scale-110') : '';

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl transition-all
        ${isMobile ? 'p-1.5' : 'p-2'} ${scale}`}
      style={isActive ? glassActive : glassBase}
    >
      {/* Avatar + info */}
      <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-1.5'}`}>
        <div className={isMobile ? 'scale-90' : ''}>
          <PlayerAvatar name={displayName} avatarUrl={seat.avatar_url} isActive={isActive} />
        </div>
        <div className="flex flex-col items-start">
          <span className={`font-medium text-on-surface truncate max-w-[50px] md:max-w-[60px]
            ${isMobile ? 'text-[8px]' : 'text-[10px]'}`}
          >
            {displayName}
          </span>
          <ChipStack amount={seat.stack} />
        </div>
      </div>

      {/* Cards — smaller on mobile */}
      <div className="flex gap-0.5">
        {isHero ? (
          seat.hole_cards?.length > 0 ? (
            seat.hole_cards.map((c: any, i: number) => (
              <Card key={i} rank={c.rank} suit={c.suit} className={isMobile ? 'w-6 h-9' : 'w-8 h-11'} />
            ))
          ) : null
        ) : (
          <>
            <CardBack className={isMobile ? 'w-6 h-9' : 'w-8 h-11'} />
            <CardBack className={isMobile ? 'w-6 h-9' : 'w-8 h-11'} />
          </>
        )}
      </div>

      {/* Current bet */}
      {seat.current_bet > 0 && (
        <div className="px-1 py-0.5 rounded-full bg-tertiary/20 border border-tertiary/30 text-tertiary font-mono text-[8px] md:text-[10px]">
          ${seat.current_bet}
        </div>
      )}

      {/* Position badge */}
      {seat.position_badge && (
        <Badge variant={seat.position_badge === 'BTN' ? 'dealer' : 'co'}>
          {seat.position_badge}
        </Badge>
      )}
    </div>
  );
};
