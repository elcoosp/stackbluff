import { useEffect, useState, useMemo } from 'react';
import { Trans, t } from '@lingui/react/macro';

interface SeasonPassTimerProps {
  expiresAt: string;
}

export function SeasonPassTimer({ expiresAt }: SeasonPassTimerProps) {
  const deadline = useMemo(() => {
    const d = new Date(expiresAt);
    return isNaN(d.getTime()) ? null : d.getTime();
  }, [expiresAt]);

  const [remaining, setRemaining] = useState(() => {
    if (!deadline) return 0;
    return Math.max(0, deadline - Date.now());
  });

  useEffect(() => {
    if (!deadline) {
      setRemaining(0);
      return;
    }
    const interval = setInterval(() => {
      setRemaining(Math.max(0, deadline - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline || remaining === 0) {
    return <span className="text-sm text-red-400"><Trans>Expired</Trans></span>;
  }

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <span className="text-sm text-emerald-400">
      <Trans>{days}d {hours}h remaining</Trans>
    </span>
  );
}
