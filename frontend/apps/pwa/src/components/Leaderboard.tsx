import { BadgeIcon } from './BadgeIcon';

interface LeaderboardProps {
  userId: string;
}

export function Leaderboard({ userId }: LeaderboardProps) {
  return (
    <div className="leaderboard">
      <span>User {userId}</span>
      <BadgeIcon userId={userId} />
    </div>
  );
}
