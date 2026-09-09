import { Trans } from '@lingui/react/macro';
import { Dialog } from '@stackbluff/shared/components/Dialog';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Clock, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface KickVoteDialogProps {
  open: boolean;
  onClose: () => void;
  initiatorId: string;
  targetId: string;
  targetName: string;
  kickVoteId: string;
  durationSecs: number;
  requiredVotes: number;
  onVoteYes: (kickVoteId: string) => void;
  onTimeout: () => void;
}

export function KickVoteDialog({
  open,
  onClose,
  targetId,
  targetName,
  kickVoteId,
  durationSecs,
  requiredVotes,
  onVoteYes,
  onTimeout,
}: KickVoteDialogProps) {
  const [timeLeft, setTimeLeft] = useState(durationSecs);
  const [votes, setVotes] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    if (!open) {
      setTimeLeft(durationSecs);
      setVotes(0);
      setHasVoted(false);
      setPassed(false);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!hasVoted && votes < requiredVotes) {
            onTimeout();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Listen for kick vote updates
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.kickVoteId === kickVoteId) {
        setVotes(detail.yesVotes || 0);
        if (detail.passed) {
          setPassed(true);
          setHasVoted(true);
        }
      }
    };
    window.addEventListener('kickVoteUpdate', handler as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('kickVoteUpdate', handler as EventListener);
    };
  }, [open, durationSecs, kickVoteId, requiredVotes, hasVoted, votes, onTimeout]);

  const handleVoteYes = () => {
    if (hasVoted) return;
    setHasVoted(true);
    setVotes((v) => v + 1);
    onVoteYes(kickVoteId);
  };

  const progress = Math.min((votes / requiredVotes) * 100, 100);
  const isTimeout = timeLeft === 0 && !passed && votes < requiredVotes;

  return (
    <Dialog open={open} onClose={onClose} showCloseButton={false}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-on-surface">
              <Trans>Kick Vote</Trans>
            </h2>
          </div>
          <div className="flex items-center gap-1 text-sm font-mono text-on-surface-variant">
            <Clock className="w-4 h-4" />
            <span className={cn(timeLeft <= 5 ? 'text-red-400' : '')}>{timeLeft}s</span>
          </div>
        </div>

        <p className="text-sm text-on-surface-variant mb-4">
          <Trans>
            Vote to remove <span className="text-on-surface font-medium">{targetName}</span> from
            the table.
          </Trans>
          {requiredVotes} <Trans>votes needed.</Trans>
        </p>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-on-surface-variant mb-1">
            <span>
              {votes} <Trans>votes</Trans>
            </span>
            <span>
              {requiredVotes} <Trans>needed</Trans>
            </span>
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-yellow-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {passed ? (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            <Trans>Vote passed! Player will be removed.</Trans>
          </div>
        ) : isTimeout ? (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <Trans>Vote timed out. Player stays.</Trans>
          </div>
        ) : (
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleVoteYes}
              disabled={hasVoted}
              className={cn(
                'flex-1 py-2 rounded-lg font-medium transition-colors',
                hasVoted
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
              )}
            >
              {hasVoted ? <Trans>Voted ✓</Trans> : <Trans>Vote Yes</Trans>}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
            >
              <Trans>Cancel</Trans>
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
