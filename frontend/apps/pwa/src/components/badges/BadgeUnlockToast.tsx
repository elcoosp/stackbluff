import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type React from 'react';
import { useEffect, useState } from 'react';

interface Props {
  badgeType: string;
  inviteLink?: string;
}

export const BadgeUnlockToast: React.FC<Props> = ({ inviteLink }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const handleShare = () => {
    const message = t`I just became a Founding Member of StackBluff by referring 10 friends who played 5+ hands! Join me: ${inviteLink || window.location.origin}`;

    if (navigator.share) {
      navigator
        .share({ title: t`StackBluff Founding Member`, text: message })
        .catch(() => navigator.clipboard.writeText(message));
    } else {
      navigator.clipboard.writeText(message).catch(() => {});
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in">
      <div className="rounded-lg border bg-card p-4 shadow-lg max-w-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🏆</span>
          <div className="flex-1">
            <p className="font-semibold text-sm">
              <Trans>You've unlocked the Founding Member badge!</Trans>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <Trans>Share your achievement with friends.</Trans>
            </p>
            <button
              type="button"
              onClick={handleShare}
              className="mt-2 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Trans>Share</Trans>
            </button>
          </div>
          <button
            type="button"
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
