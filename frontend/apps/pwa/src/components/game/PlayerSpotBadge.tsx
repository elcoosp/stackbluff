import { useUserBadges } from '../../hooks/useBadges';

// Define the expected shape of a badge – adjust to match your actual type
interface Badge {
  badge_type: string;
  // add other fields as needed, e.g. id, created_at, etc.
}

interface PlayerSpotBadgeProps {
  /** User ID – used to fetch badges when none are provided */
  userId: string;
  /** Optional pre‑fetched badges – if given, we skip the API call */
  badges?: Badge[];
  /** Whether the badge should be shown at all – defaults to true */
  showBadges?: boolean;
}

export function PlayerSpotBadge({
  userId,
  badges: propBadges,
  showBadges = true,
}: PlayerSpotBadgeProps) {
  // Always call the hook (React rules), but we'll ignore its result if we have propBadges
  const { data: fetchedBadges } = useUserBadges(userId);

  // Use the prop badges if provided, otherwise fall back to fetched data
  const badges = propBadges || fetchedBadges || [];

  // If showBadges is false, render nothing
  if (!showBadges) return null;

  // Check for the specific badge type we care about
  const hasFoundingMember = badges.some(
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
