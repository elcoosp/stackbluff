import { useUserBadges } from "../hooks/useBadges";

interface BadgeIconProps {
  userId: string;
}

export function BadgeIcon({ userId }: BadgeIconProps) {
  const { data: badges } = useUserBadges(userId);

  const hasFoundingMember = badges?.some(
    (b) => b.badge_type === "founding_member"
  );

  if (!hasFoundingMember) return null;

  return (
    <span
      title="Founding Member – Referred 10 friends who played 5+ hands"
      className="inline-block ml-1"
    >
      👑
    </span>
  );
}
