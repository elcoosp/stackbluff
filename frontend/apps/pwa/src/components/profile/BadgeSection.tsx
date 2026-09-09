import type React from 'react';
import { useBadges } from '../../hooks/useBadges';
import { BadgeIcon, FoundingMemberProgress } from '../badges';

export const BadgeSection: React.FC = () => {
  const { data: badges, isLoading } = useBadges();

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading badges…</div>;

  const hasFoundingMember = badges?.some((b) => b.badge_type === 'founding_member');

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Badges
      </h3>

      {hasFoundingMember ? (
        <div className="flex items-center gap-2">
          <BadgeIcon badgeType="founding_member" size={20} />
          <span className="text-sm font-medium">Founding Member</span>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No badges yet.</div>
      )}

      {!hasFoundingMember && <FoundingMemberProgress completed={0} required={10} />}
    </div>
  );
};
