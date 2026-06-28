interface ClubTournamentsTabProps {
  clubId: string;
}

export function ClubTournamentsTab({ clubId }: ClubTournamentsTabProps) {
  return (
    <div className="text-white/60">
      <p>Tournaments for club {clubId} – implementation in next step.</p>
    </div>
  );
}
