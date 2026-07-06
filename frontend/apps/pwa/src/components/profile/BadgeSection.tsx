import React from "react";
import { useBadges } from "../../hooks/useBadges";
import { BadgeIcon, FoundingMemberProgress } from "../badges";

export const BadgeSection: React.FC = () => {
  const { data, isLoading } = useBadges();

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading badges…</div>;

  const hasFoundingMember = data?.badges.some((b) => b.badge_type === "founding_member");

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

      {data?.founding_member_progress && !hasFoundingMember && (
        <FoundingMemberProgress
          completed={data.founding_member_progress.completed}
          required={data.founding_member_progress.required}
        />
      )}
    </div>
  );
};
