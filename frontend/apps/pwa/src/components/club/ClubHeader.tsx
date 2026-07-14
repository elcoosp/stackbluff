import { motion } from 'framer-motion';
import { Sparkles, Users } from 'lucide-react';
import type { ClubDetails } from '../../types/club';
import { Trans, t } from '@lingui/react/macro';

interface ClubHeaderProps {
  club: ClubDetails;
}

export function ClubHeader({ club }: ClubHeaderProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-data-mono uppercase tracking-widest text-purple-400">
          <Trans>Community & Play</Trans>
        </span>
      </div>
      <div className="flex items-center gap-4 mt-2">
        {club.logo_url ? (
          <img
            src={club.logo_url}
            alt={club.name}
            className="w-16 h-16 rounded-2xl object-cover border border-white/10 shadow-lg"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center text-2xl font-bold text-white border border-white/10 shadow-lg">
            {club.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface">
            {club.name}
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> {club.members_count} <Trans>members</Trans>
          </p>
        </div>
      </div>
    </div>
  );
}
