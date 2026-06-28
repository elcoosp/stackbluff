import React, { useEffect, useState } from "react";
import { PlatformAPI } from "../../platform/PlatformAPI";

interface Props {
  badgeType: string;
  inviteLink?: string;
}

export const BadgeUnlockToast: React.FC<Props> = ({ badgeType, inviteLink }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const handleShare = () => {
    const message = `I just became a Founding Member of StackBluff by referring 10 friends who played 5+ hands! Join me: ${inviteLink || window.location.origin}`;
    PlatformAPI.shareContent?.({ message }).catch(() => {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(message);
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in">
      <div className="rounded-lg border bg-card p-4 shadow-lg max-w-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🏆</span>
          <div className="flex-1">
            <p className="font-semibold text-sm">
              You’ve unlocked the Founding Member badge!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Share your achievement with friends.
            </p>
            <button
              onClick={handleShare}
              className="mt-2 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Share
            </button>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
