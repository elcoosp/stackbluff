import { RefreshCw } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface ResyncButtonProps {
  isProcessing: boolean;
  onClick: () => void;
}

export function ResyncButton({ isProcessing, onClick }: ResyncButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isProcessing}
      data-testid="notifications-resync"
      className="w-full px-4 py-2.5 rounded-lg border border-white/20 bg-transparent text-white text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-3 flex items-center justify-center gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
      <Trans>Re-sync Subscription</Trans>
    </button>
  );
}
