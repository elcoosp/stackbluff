import { useConsentStore } from '@/stores/consentStore';
import { trackEvent } from '@/lib/analytics';
import { consentLogger } from '@/lib/logger';
import {
  ANALYTICS_COOKIE_CONSENT_ACCEPTED,
  ANALYTICS_COOKIE_CONSENT_DECLINED,
} from '@/lib/consent/constants';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

/**
 * Cookie consent banner – bottom-fixed, non-dismissible except via Accept/Decline.
 * Uses Tailwind CSS for styling (no inline styles).
 */
export function CookieConsentBanner() {
  const cookieConsent = useConsentStore((s) => s.cookieConsent);
  const setCookieConsent = useConsentStore((s) => s.setCookieConsent);

  const isVisible = cookieConsent === 'not_set';

  const handleAccept = () => {
    consentLogger.info('Cookie consent accepted');
    setCookieConsent('accepted');
    trackEvent(ANALYTICS_COOKIE_CONSENT_ACCEPTED);
  };

  const handleDecline = () => {
    consentLogger.info('Cookie consent declined');
    setCookieConsent('declined');
    trackEvent(ANALYTICS_COOKIE_CONSENT_DECLINED);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-black/85 backdrop-blur-sm p-4 sm:p-6"
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-description"
      data-testid="cookie-consent-banner"
    >
      <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
        <p
          id="cookie-consent-description"
          className="text-sm text-white flex-1 m-0"
        >
          <Trans>We use cookies for analytics and to improve your experience. By clicking "Accept", you consent to our use of cookies.</Trans>
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleDecline}
            data-testid="cookie-consent-decline"
            className="px-4 py-2 rounded-md border border-white/30 bg-transparent text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <Trans>Decline</Trans>
          </button>
          <button
            type="button"
            onClick={handleAccept}
            data-testid="cookie-consent-accept"
            className="px-4 py-2 rounded-md border-none bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
          >
            <Trans>Accept</Trans>
          </button>
        </div>
      </div>
    </div>
  );
}
