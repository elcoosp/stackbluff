import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Smartphone, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { trackEvent } from '@/lib/analytics';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const INSTALL_DISMISSED_KEY = 'stackbluff-install-dismissed';
const INSTALL_DISMISSED_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if already installed
  useEffect(() => {
    const checkInstalled = () => {
      // Check if running in standalone mode (PWA installed)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (isStandalone) {
        setIsInstalled(true);
        return;
      }

      // iOS detection (older iOS uses navigator.standalone)
      if (navigator.standalone === true) {
        setIsInstalled(true);
        return;
      }

      // Check if dismissed recently
      const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        if (Date.now() - dismissedTime < INSTALL_DISMISSED_EXPIRY) {
          return; // Don't show if dismissed recently
        }
      }

      // Detect mobile
      const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
    };

    checkInstalled();
  }, []);

  // Listen for beforeinstallprompt
  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show if not installed and not dismissed
      if (!isInstalled) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Also check for appinstalled event
    const installedHandler = () => {
      setIsInstalled(true);
      setIsVisible(false);
      trackEvent('pwa_installed');
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [isInstalled]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      // Fallback: open app store or guide
      if (isMobile) {
        // On iOS, suggest adding to home screen
        alert(
          t`To install StackBluff on your device: tap the share button and select "Add to Home Screen".`,
        );
      } else {
        alert(t`To install StackBluff: click the install icon in your browser address bar.`);
      }
      return;
    }

    trackEvent('pwa_install_clicked');

    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        trackEvent('pwa_install_accepted');
        setIsVisible(false);
      } else {
        trackEvent('pwa_install_dismissed');
        // Dismiss for a while
        localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Install prompt failed:', error);
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt, isMobile]);

  const handleDismiss = useCallback(() => {
    trackEvent('pwa_install_dismissed_banner');
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    setIsVisible(false);
  }, []);

  if (!isVisible || isInstalled) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="fixed bottom-0 left-0 right-0 z-[6000] p-4 bg-surface-container border-t border-white/10 shadow-2xl backdrop-blur-md"
        style={{
          background: 'rgba(10, 10, 10, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="max-w-md mx-auto">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-tertiary" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-tertiary" />
                <Trans>Install StackBluff</Trans>
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                <Trans>Get the app for a faster, smoother experience with offline support.</Trans>
              </p>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-on-surface transition-colors flex-shrink-0"
              aria-label="Dismiss install prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 py-2.5 rounded-lg border border-white/10 text-on-surface-variant text-sm font-medium hover:bg-white/5 transition-colors"
            >
              <Trans>Maybe Later</Trans>
            </button>
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 py-2.5 rounded-lg bg-tertiary text-on-tertiary text-sm font-semibold hover:bg-tertiary/80 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <Trans>Install App</Trans>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
