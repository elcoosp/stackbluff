import type React from 'react';
import { BadgeIcon } from '../badges';

interface Props {
  userId: string;
  badges?: string[];
}

export const LeaderboardBadge: React.FC<Props> = ({ badges }) => {
  if (!badges?.includes('founding_member')) return null;
  return <BadgeIcon badgeType="founding_member" size={14} className="ml-1" />;
};
