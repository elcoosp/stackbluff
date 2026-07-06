import { useUserBadges } from '../../hooks/useBadges';

interface PlayerSpotBadgeProps {
  userId: string;
}

export function PlayerSpotBadge({ userId }: PlayerSpotBadgeProps) {
  const { data: badges } = useUserBadges(userId);

  const hasFoundingMember = badges?.some(
    (b) => b.badge_type === 'founding_member'
  );

  if (!hasFoundingMember) return null;

  return (
    <span
      title="Founding Member – Referred 10 friends who played 5+ hands"
      className="ml-1 text-xs"
    >
      👑
    </span>
  );
}
