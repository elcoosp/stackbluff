import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { authApi } from '@stackbluff/shared/auth/api';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { AlertCircle, CheckCircle, Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function AccountSettings() {
  const { user } = useAuthStore();
  const [isResending, setIsResending] = useState(false);

  const isEmailVerified = user?.email_verified_at != null;
  const hasEmail = user?.email && user.email.length > 0;

  const handleResendVerification = async () => {
    if (!user?.id) {
      toast.error(t`You must be logged in to request verification.`);
      return;
    }
    setIsResending(true);
    try {
      await authApi.resendVerification();
      toast.success(t`Verification email sent! Please check your inbox.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t`Failed to send verification email.`;
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-on-surface">
        <Trans>Account Settings</Trans>
      </h2>

      {/* Email Verification Section */}
      {hasEmail && (
        <div className="p-4 rounded-lg bg-surface-container-high border border-outline-variant">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-on-surface">
                <Trans>Email Verification</Trans>
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {isEmailVerified ? (
                  <span className="flex items-center gap-1 text-tertiary">
                    <CheckCircle className="w-4 h-4" />
                    <Trans>Verified</Trans>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <AlertCircle className="w-4 h-4" />
                    <Trans>Not verified</Trans>
                  </span>
                )}
              </p>
            </div>
            {!isEmailVerified && (
              <Button
                onClick={handleResendVerification}
                disabled={isResending}
                variant="outline"
                className="text-sm"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <Trans>Sending...</Trans>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    <Trans>Resend Verification</Trans>
                  </>
                )}
              </Button>
            )}
          </div>
          {!isEmailVerified && (
            <p className="text-xs text-on-surface-variant mt-2">
              <Trans>
                Verify your email to unlock full account features and secure your account.
              </Trans>
            </p>
          )}
        </div>
      )}

      {/* Additional account settings can go here */}
      <div className="p-4 rounded-lg bg-surface-container-high border border-outline-variant">
        <p className="text-sm text-on-surface">
          <Trans>Account ID:</Trans> {user?.id || t`Not logged in`}
        </p>
        <p className="text-xs text-on-surface-variant mt-1">
          <Trans>Platform:</Trans> {user?.platform || t`Unknown`}
        </p>
      </div>
    </div>
  );
}
