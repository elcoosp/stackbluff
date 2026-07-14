import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setWasOffline(true);
      // Auto-hide after 3 seconds when coming back online
      setTimeout(() => {
        setWasOffline(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  // Don't show anything if online and wasn't recently offline
  if (!isOffline && !wasOffline) {
    return null;
  }

  return (
    <AnimatePresence>
      {(isOffline || wasOffline) && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          className={cn(
            'fixed top-16 left-0 right-0 z-[6000] p-3 text-center text-sm font-medium backdrop-blur-md border-b transition-colors',
            isOffline
              ? 'bg-red-500/20 border-red-500/30 text-red-400'
              : 'bg-green-500/20 border-green-500/30 text-green-400'
          )}
        >
          <div className="max-w-md mx-auto flex items-center justify-center gap-3">
            {isOffline ? (
              <>
                <WifiOff className="w-4 h-4" />
                <span><Trans>You are offline. Some features may be unavailable.</Trans></span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  aria-label="Retry connection"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                <span><Trans>Back online! Reconnecting...</Trans></span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
