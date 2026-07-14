import { useBadges } from "../hooks/useBadges";
import { Crown } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";

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
      <div className="flex items-center gap-2" title={t`Founding Member – Referred 10 friends who played 5+ hands`}>
        <Crown className="w-5 h-5 text-yellow-400" />
        <span className="text-sm font-semibold text-yellow-600"><Trans>Founding Member</Trans></span>
      </div>
    );
  }

  if (showProgress) {
    return (
      <div className="text-sm text-gray-600">
        <div className="mb-1"><Trans>Referral progress: {referralCount}/10</Trans></div>
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
