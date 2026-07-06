import { useBadges } from "../hooks/useBadges";

interface BadgeDisplayProps {
  showProgress?: boolean;
}

export function BadgeDisplay({ showProgress = true }: BadgeDisplayProps) {
  const { data: badges, isLoading } = useBadges();

  if (isLoading) return null;

  const hasFoundingMember = badges?.some(
    (b) => b.badge_type === "founding_member"
  );

  // TODO: Get actual referral count from API
  const referralCount = 0; // Replace with real data

  if (hasFoundingMember) {
    return (
      <div className="flex items-center gap-2" title="Founding Member – Referred 10 friends who played 5+ hands">
        <span className="text-2xl">👑</span>
        <span className="text-sm font-semibold text-yellow-600">Founding Member</span>
      </div>
    );
  }

  if (showProgress) {
    return (
      <div className="text-sm text-gray-600">
        <div className="mb-1">Referral progress: {referralCount}/10</div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-yellow-600 h-2.5 rounded-full"
            style={{ width: `${Math.min((referralCount / 10) * 100, 100)}%` }}
          ></div>
        </div>
      </div>
    );
  }

  return null;
}
