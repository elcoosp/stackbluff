import { PlayerSpotBadge } from './PlayerSpotBadge';

interface PlayerSpotProps {
  userId: string;
}

export function PlayerSpot({ userId }: PlayerSpotProps) {
  return (
    <div className="player-spot">
      <span>Player {userId}</span>
      <PlayerSpotBadge userId={userId} />
    </div>
  );
}
