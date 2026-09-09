import { t } from '@lingui/core/macro';
import type { PermissionDisplay } from './types';

interface ToggleButtonProps {
  status: PermissionDisplay;
  isProcessing: boolean;
  onClick: () => void;
}

export function ToggleButton({ status, isProcessing, onClick }: ToggleButtonProps) {
  if (status === 'unsupported') return null;

  const isEnabled = status === 'enabled';
  const isBlocked = status === 'blocked';

  const label = isProcessing
    ? t`Processing...`
    : isEnabled
      ? t`Disable Notifications`
      : isBlocked
        ? t`Enable in Browser Settings`
        : t`Enable Notifications`;

  const colorClass = isEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isProcessing}
      data-testid="notifications-toggle"
      className={`w-full px-4 py-3 rounded-lg border-none text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-3 ${colorClass}`}
    >
      {label}
    </button>
  );
}
