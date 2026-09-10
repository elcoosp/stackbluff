import { authApi } from '@stackbluff/shared/auth/api';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { Link } from '@tanstack/react-router';
import { Mail, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function EmailVerificationBanner() {
  const { user } = useAuthStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const isPWA = user?.platform === 'pwa';
  const isVerified = user?.email_verified_at != null;
  const hasEmail = user?.email && user.email.length > 0;

  // Only show for PWA users with email, not verified, and not dismissed
  const shouldShow = isPWA && hasEmail && !isVerified && !isDismissed;

  if (!shouldShow) {
    return null;
  }

  const handleResend = async () => {
    setIsResending(true);
    try {
      await authApi.resendVerification();
      toast.success('Verification email sent! Please check your inbox.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="relative bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3 text-center text-sm">
      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Mail className="w-4 h-4 text-yellow-400" />
        <span className="text-yellow-200">
          Please verify your email address to unlock all features.
        </span>
        <div>
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-yellow-400 hover:text-yellow-300 underline-offset-2 underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending ? 'Sending...' : 'Resend verification email'}
          </button>
          <span className="text-yellow-200/60"> | </span>
          <Link
            to="/settings"
            className="text-yellow-400 hover:text-yellow-300 underline-offset-2 underline"
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
