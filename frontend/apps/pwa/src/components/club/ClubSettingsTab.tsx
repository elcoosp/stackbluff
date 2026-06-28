import type { ClubDetails } from '../../pages/ClubPage';

interface ClubSettingsTabProps {
  club: ClubDetails;
}

export function ClubSettingsTab({ club }: ClubSettingsTabProps) {
  return (
    <div className="text-white/60">
      <p>Settings for club "{club.name}" – implementation in next step.</p>
    </div>
  );
}
