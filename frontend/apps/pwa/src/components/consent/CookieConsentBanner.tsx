import { useConsentStore } from '@/stores/consentStore';

/**
 * Cookie consent banner – bottom-fixed, non-dismissible except via Accept/Decline.
 * Uses only React + the consent store (no external UI library dependencies).
 */
export function CookieConsentBanner() {
  const cookieConsent = useConsentStore((s) => s.cookieConsent);
  const setCookieConsent = useConsentStore((s) => s.setCookieConsent);

  const isVisible = cookieConsent === 'not_set';

  const handleAccept = () => {
    setCookieConsent('accepted');
    // Fire analytics event now that consent is given
    if (typeof window !== 'undefined' && 'plausible' in window) {
      (window as any).plausible?.('cookie_consent_accepted');
    }
  };

  const handleDecline = () => {
    setCookieConsent('declined');
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-description"
      data-testid="cookie-consent-banner"
    >
      <div
        style={{
          maxWidth: '56rem',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          alignItems: 'center',
          textAlign: 'center',
        }}
        className="sm:flex-row sm:text-left"
      >
        <p
          id="cookie-consent-description"
          style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5, flex: 1 }}
        >
          We use cookies for analytics and to improve your experience. By clicking
          &ldquo;Accept&rdquo;, you consent to our use of cookies.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleDecline}
            data-testid="cookie-consent-decline"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid rgba(255,255,255,0.3)',
              backgroundColor: 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAccept}
            data-testid="cookie-consent-accept"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
