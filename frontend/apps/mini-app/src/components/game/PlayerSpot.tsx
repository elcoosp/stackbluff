import { Badge, Card, CardBack, ChipStack, PlayerAvatar } from './';

interface HoleCard {
  rank: string;
  suit: string;
}

interface SeatData {
  display_name: string;
  avatar_url?: string;
  is_active: boolean;
  stack: number;
  hole_cards?: HoleCard[];
  position_badge?: string;
}

export const PlayerSpot = ({ seat, isHero }: { seat: SeatData; isHero?: boolean }) => (
  <div className="flex flex-col items-center gap-2 p-3 rounded-xl glass-hub min-w-[120px]">
    <PlayerAvatar name={seat.display_name} avatarUrl={seat.avatar_url} isActive={seat.is_active} />
    <div className="flex gap-1">
      {isHero ? (
        seat.hole_cards?.map((c) => (
          <Card key={`${c.rank}-${c.suit}`} rank={c.rank} suit={c.suit} className="w-12 h-16" />
        ))
      ) : (
        <>
          <CardBack className="w-12 h-16" />
          <CardBack className="w-12 h-16" />
        </>
      )}
    </div>
    <ChipStack amount={seat.stack} />
    {seat.position_badge && (
      <Badge variant={seat.position_badge === 'BTN' ? 'dealer' : 'co'}>{seat.position_badge}</Badge>
    )}
  </div>
);
