import React from "react";
import { t } from "@lingui/core/macro";

interface BadgeIconProps {
  badgeType: string;
  size?: number;
  className?: string;
}

const BADGE_META: Record<string, { icon: string; label: string; tooltip: string }> = {
  founding_member: {
    icon: "👑",
    label: t`Founding Member`,
    tooltip: t`Founding Member – Referred 10 friends who played 5+ hands.`,
  },
};

export const BadgeIcon: React.FC<BadgeIconProps> = ({
  badgeType,
  size = 16,
  className = "",
}) => {
  const meta = BADGE_META[badgeType];
  if (!meta) return null;

  return (
    <span
      title={meta.tooltip}
      className={`inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.6 }}
    >
      {meta.icon}
    </span>
  );
};

export const BADGE_TYPES = Object.keys(BADGE_META);
