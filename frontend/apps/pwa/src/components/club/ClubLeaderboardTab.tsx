interface ClubLeaderboardTabProps {
  clubId: string;
}

export function ClubLeaderboardTab({ clubId }: ClubLeaderboardTabProps) {
  return (
    <div className="text-white/60">
      <p>Leaderboard for club {clubId} – implementation in next step.</p>
    </div>
  );
}
