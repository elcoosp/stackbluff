import { useState } from 'react';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { authApi } from '@stackbluff/shared/auth/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';

export function AccountSettings() {
  const { user, loadUser } = useAuthStore();
  const [isResending, setIsResending] = useState(false);

  const isEmailVerified = user?.email_verified_at != null;
  const hasEmail = user?.email && user.email.length > 0;

  const handleResendVerification = async () => {
    if (!user?.id) {
      toast.error('You must be logged in to request verification.');
      return;
    }
    setIsResending(true);
    try {
      await authApi.resendVerification();
      toast.success('Verification email sent! Please check your inbox.');
      // After resend, we could optionally refresh user data to reflect the new verification status
      // But the user won't be verified until they click the link, so we don't need to reload.
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send verification email.';
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-on-surface">Account Settings</h2>

      {/* Email Verification Section */}
      {hasEmail && (
        <div className="p-4 rounded-lg bg-surface-container-high border border-outline-variant">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-on-surface">Email Verification</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {isEmailVerified ? (
                  <span className="flex items-center gap-1 text-tertiary">
                    <CheckCircle className="w-4 h-4" />
                    Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <AlertCircle className="w-4 h-4" />
                    Not verified
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
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Resend Verification
                  </>
                )}
              </Button>
            )}
          </div>
          {!isEmailVerified && (
            <p className="text-xs text-on-surface-variant mt-2">
              Verify your email to unlock full account features and secure your account.
            </p>
          )}
        </div>
      )}

      {/* Additional account settings can go here */}
      <div className="p-4 rounded-lg bg-surface-container-high border border-outline-variant">
        <p className="text-sm text-on-surface">Account ID: {user?.id || 'Not logged in'}</p>
        <p className="text-xs text-on-surface-variant mt-1">
          Platform: {user?.platform || 'Unknown'}
        </p>
      </div>
    </div>
  );
}
