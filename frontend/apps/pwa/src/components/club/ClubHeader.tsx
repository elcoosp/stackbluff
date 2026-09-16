import { Trans } from '@lingui/react/macro';
import { Users } from 'lucide-react';
import type { ClubDetails } from '../../types/club';

interface ClubHeaderProps {
  club: ClubDetails;
}

export function ClubHeader({ club }: ClubHeaderProps) {
  return (
    <div>
      <div className="flex items-center gap-4 mt-2">
        {club.logo_url ? (
          <img
            src={club.logo_url}
            alt={club.name}
            className="w-16 h-16 rounded-2xl object-cover raised-panel"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl raised-panel bg-surface-container-high flex items-center justify-center text-2xl font-bold text-on-surface">
            {club.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface">{club.name}</h1>
          <p className="text-on-surface-variant text-sm mt-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> {club.members_count} <Trans>members</Trans>
          </p>
        </div>
      </div>
    </div>
  );
}
