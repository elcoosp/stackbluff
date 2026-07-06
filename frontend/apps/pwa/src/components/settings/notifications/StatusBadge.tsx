import type { PermissionDisplay } from './types';

interface StatusBadgeProps {
  status: PermissionDisplay;
}

const STATUS_CONFIG: Record<PermissionDisplay, { label: string; className: string }> = {
  enabled: { label: '✅ Enabled', className: 'bg-green-500/20 text-green-400' },
  blocked: { label: '🚫 Blocked', className: 'bg-red-500/20 text-red-400' },
  not_set: { label: '⚪ Not set', className: 'bg-white/10 text-white/80' },
  unsupported: { label: '⚠️ Not supported', className: 'bg-yellow-500/20 text-yellow-400' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`text-sm font-medium px-3 py-1 rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
}
