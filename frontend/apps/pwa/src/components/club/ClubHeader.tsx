import type { ClubDetails } from '../../types/club';

interface ClubHeaderProps {
  club: ClubDetails;
}

export function ClubHeader({ club }: ClubHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-4">
        {club.logo_url ? (
          <img
            src={club.logo_url}
            alt={club.name}
            className="w-16 h-16 rounded-lg object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center text-2xl font-bold text-white/60">
            {club.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold text-white">{club.name}</h1>
          <p className="text-white/60">{club.members_count} members</p>
        </div>
      </div>
    </div>
  );
}
