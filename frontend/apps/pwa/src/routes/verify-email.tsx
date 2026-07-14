import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { authApi } from '@stackbluff/shared/auth/api';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { Link } from '@tanstack/react-router';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

type SearchParams = {
  token?: string;
};

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, string>): SearchParams => ({
    token: search.token || '',
  }),
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: '/verify-email' });
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        await authApi.verifyEmail(token);
        setStatus('success');
        toast.success(t`Email verified successfully!`);
      } catch (error) {
        setStatus('error');
        toast.error(error instanceof Error ? error.message : t`Verification failed`);
      }
    };

    verify();
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
        <div className="relative z-10 w-full max-w-md">
          <GlassPanel>
            <div className="text-center p-8">
              <div className="flex justify-center mb-4">
                <Loader2 className="w-16 h-16 text-tertiary animate-spin" />
              </div>
              <h2 className="text-lg font-semibold text-on-surface mb-2"><Trans>Verifying...</Trans></h2>
              <p className="text-on-surface-variant text-sm"><Trans>Please wait while we verify your email.</Trans></p>
            </div>
          </GlassPanel>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter"><Trans>STACKBLUFF</Trans></h1>
            <p className="font-data-mono text-xs text-outline mt-2 tracking-widest"><Trans>EMAIL VERIFIED</Trans></p>
          </div>
          <GlassPanel>
            <div className="space-y-6 p-2 text-center">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-tertiary" />
              </div>
              <h2 className="text-lg font-semibold text-on-surface"><Trans>Email Verified!</Trans></h2>
              <p className="text-on-surface-variant text-sm">
                <Trans>Your email has been successfully verified. You can now access all features.</Trans>
              </p>
              <LiquidMetalButton
                type="button"
                variant="silver"
                className="w-full"
                onClick={() => navigate({ to: '/lobby' })}
              >
                <Trans>Continue to Lobby</Trans>
              </LiquidMetalButton>
            </div>
          </GlassPanel>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter"><Trans>STACKBLUFF</Trans></h1>
          <p className="font-data-mono text-xs text-outline mt-2 tracking-widest"><Trans>VERIFICATION FAILED</Trans></p>
        </div>
        <GlassPanel>
          <div className="space-y-6 p-2 text-center">
            <div className="flex justify-center">
              <XCircle className="w-16 h-16 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-on-surface"><Trans>Verification Failed</Trans></h2>
            <p className="text-on-surface-variant text-sm">
              {token ? t`The verification link is invalid or has expired.` : t`No verification token provided.`}
            </p>
            <div className="space-y-3">
              <LiquidMetalButton
                type="button"
                variant="silver"
                className="w-full"
                onClick={() => navigate({ to: '/login' })}
              >
                <ArrowLeft className="w-4 h-4 mr-2 inline" />
                <Trans>Back to Sign In</Trans>
              </LiquidMetalButton>
              <p className="text-xs text-on-surface-variant">
                <Trans>If you didn't receive a verification email, you can request a new one from your account settings.</Trans>
              </p>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
