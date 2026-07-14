import React from "react";
import { Trans } from "@lingui/react/macro";

interface Props {
  completed: number;
  required: number;
}

export const FoundingMemberProgress: React.FC<Props> = ({ completed, required }) => {
  const pct = Math.min((completed / required) * 100, 100);
  return (
    <div className="w-full max-w-xs">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span><Trans>Referral progress</Trans></span>
        <span>
          <Trans>{completed}/{required} referrals completed</Trans>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
