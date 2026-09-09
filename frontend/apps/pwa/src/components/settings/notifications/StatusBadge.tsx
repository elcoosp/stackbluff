import { t } from '@lingui/core/macro';
import { AlertTriangle, CheckCircle, Circle, type LucideIcon, XCircle } from 'lucide-react';
import type { PermissionDisplay } from './types';

interface StatusBadgeProps {
  status: PermissionDisplay;
}

const STATUS_CONFIG: Record<
  PermissionDisplay,
  { label: string; className: string; icon: LucideIcon }
> = {
  enabled: { label: t`Enabled`, className: 'bg-green-500/20 text-green-400', icon: CheckCircle },
  blocked: { label: t`Blocked`, className: 'bg-red-500/20 text-red-400', icon: XCircle },
  not_set: { label: t`Not set`, className: 'bg-white/10 text-white/80', icon: Circle },
  unsupported: {
    label: t`Not supported`,
    className: 'bg-yellow-500/20 text-yellow-400',
    icon: AlertTriangle,
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={`text-sm font-medium px-3 py-1 rounded-full flex items-center gap-1.5 ${config.className}`}
    >
      <Icon className="w-4 h-4" />
      {config.label}
    </span>
  );
}
