import { PlayerAvatar, ChipStack, Badge, CardBack, Card } from './';
export const PlayerSpot = ({ seat, isHero }: { seat: any; isHero?: boolean }) => (
  <div className="flex flex-col items-center gap-2 p-3 rounded-xl glass-hub min-w-[120px]">
    <PlayerAvatar name={seat.display_name} avatarUrl={seat.avatar_url} isActive={seat.is_active} />
    <div className="flex gap-1">
      {isHero ? (seat.hole_cards?.map((c: any, i: number) => <Card key={i} rank={c.rank} suit={c.suit} className="w-12 h-16" />)) : (<><CardBack className="w-12 h-16" /><CardBack className="w-12 h-16" /></>)}
    </div>
    <ChipStack amount={seat.stack} />
    {seat.position_badge && <Badge variant={seat.position_badge === 'BTN' ? 'dealer' : 'co'}>{seat.position_badge}</Badge>}
  </div>
);
