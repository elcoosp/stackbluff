import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useState } from 'react';
import { authApi } from '@stackbluff/shared/auth/api';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { Link } from '@tanstack/react-router';
import { Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { Trans, t } from '@lingui/react/macro';

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, t`Password must be at least 8 characters`),
    confirmPassword: z.string().min(8, t`Password must be at least 8 characters`),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: t`Passwords do not match`,
    path: ['confirmPassword'],
  });

type SearchParams = {
  token?: string;
};

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, string>): SearchParams => ({
    token: search.token || '',
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: '/reset-password' });
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: { token: string; new_password: string }) =>
      authApi.resetPassword(data.token, data.new_password),
    onSuccess: () => {
      setSuccess(true);
      toast.success(t`Password reset successfully!`);
    },
    onError: (error) => {
      toast.error(error.message || t`Failed to reset password`);
    },
  });

  const form = useForm({
    defaultValues: { password: '', confirmPassword: '' },
    validators: { onChange: resetPasswordSchema },
    onSubmit: ({ value }) => {
      if (!token) {
        toast.error(t`Invalid or missing reset token`);
        return;
      }
      mutation.mutate({ token, new_password: value.password });
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
        <div className="relative z-10 w-full max-w-md">
          <GlassPanel>
            <div className="text-center p-4">
              <h2 className="text-lg font-semibold text-on-surface mb-2"><Trans>Invalid Reset Link</Trans></h2>
              <p className="text-on-surface-variant text-sm mb-4">
                <Trans>The password reset link is missing or invalid.</Trans>
              </p>
              <LiquidMetalButton
                type="button"
                variant="silver"
                className="w-full"
                onClick={() => navigate({ to: '/login' })}
              >
                <ArrowLeft className="w-4 h-4 mr-2 inline" />
                <Trans>Back to Sign In</Trans>
              </LiquidMetalButton>
            </div>
          </GlassPanel>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter"><Trans>STACKBLUFF</Trans></h1>
            <p className="font-data-mono text-xs text-outline mt-2 tracking-widest"><Trans>PASSWORD RESET</Trans></p>
          </div>
          <GlassPanel>
            <div className="space-y-6 p-2 text-center">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-tertiary" />
              </div>
              <h2 className="text-lg font-semibold text-on-surface"><Trans>Password Reset Successful</Trans></h2>
              <p className="text-on-surface-variant text-sm">
                <Trans>Your password has been updated. You can now sign in with your new password.</Trans>
              </p>
              <LiquidMetalButton
                type="button"
                variant="silver"
                className="w-full"
                onClick={() => navigate({ to: '/login' })}
              >
                <ArrowLeft className="w-4 h-4 mr-2 inline" />
                <Trans>Back to Sign In</Trans>
              </LiquidMetalButton>
            </div>
          </GlassPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter"><Trans>STACKBLUFF</Trans></h1>
          <p className="font-data-mono text-xs text-outline mt-2 tracking-widest"><Trans>RESET PASSWORD</Trans></p>
        </div>
        <GlassPanel>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase"
                  >
                    <Trans>New Password</Trans>
                  </Label>
                  <div className="relative mt-2">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 bg-background/50 border-white/10 text-on-surface placeholder:text-muted-foreground/50 focus-visible:ring-tertiary"
                    />
                  </div>
                  <div className="min-h-[1.5rem] overflow-hidden">
                    <AnimatePresence mode="wait">
                      {field.state.meta.errors.length > 0 && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="text-xs font-data-mono text-red-400 mt-1"
                        >
                          {field.state.meta.errors.map((e) =>
                            typeof e === 'string' ? e : e?.message || t`Invalid`
                          ).join(', ')}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => (
                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase"
                  >
                    <Trans>Confirm Password</Trans>
                  </Label>
                  <div className="relative mt-2">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 bg-background/50 border-white/10 text-on-surface placeholder:text-muted-foreground/50 focus-visible:ring-tertiary"
                    />
                  </div>
                  <div className="min-h-[1.5rem] overflow-hidden">
                    <AnimatePresence mode="wait">
                      {field.state.meta.errors.length > 0 && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="text-xs font-data-mono text-red-400 mt-1"
                        >
                          {field.state.meta.errors.map((e) =>
                            typeof e === 'string' ? e : e?.message || t`Invalid`
                          ).join(', ')}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </form.Field>

            <LiquidMetalButton
              type="submit"
              disabled={mutation.isPending}
              variant="silver"
              className="w-full"
            >
              {mutation.isPending ? t`RESETTING...` : t`RESET PASSWORD`}
            </LiquidMetalButton>

            <div className="text-center pt-4">
              <Link to="/login" className="font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface transition-all tracking-widest uppercase">
                <ArrowLeft className="w-3 h-3 inline mr-1" />
                <Trans>BACK TO SIGN IN</Trans>
              </Link>
            </div>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}
