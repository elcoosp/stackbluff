import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { authApi } from '@stackbluff/shared/auth/api';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Mail } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, t`Email is required`).email(t`Invalid email address`),
});

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (error) => {
      toast.error(error.message || t`Something went wrong`);
    },
  });

  const form = useForm({
    defaultValues: { email: '' },
    validators: { onChange: forgotPasswordSchema },
    onSubmit: ({ value }) => mutation.mutate(value.email),
  });

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter">
              <Trans>STACKBLUFF</Trans>
            </h1>
            <p className="font-data-mono text-xs text-outline mt-2 tracking-widest">
              <Trans>PASSWORD RESET</Trans>
            </p>
          </div>
          <GlassPanel>
            <div className="space-y-6 p-2">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-on-surface mb-2">
                  <Trans>Check your email</Trans>
                </h2>
                <p className="text-on-surface-variant text-sm">
                  <Trans>If the email exists, we've sent a password reset link.</Trans>
                </p>
              </div>
              <LiquidMetalButton
                type="button"
                variant="silver"
                className="w-full"
                onClick={() => navigate({ to: '/login' })}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
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
          <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter">
            <Trans>STACKBLUFF</Trans>
          </h1>
          <p className="font-data-mono text-xs text-outline mt-2 tracking-widest">
            <Trans>RESET PASSWORD</Trans>
          </p>
        </div>
        <GlassPanel>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase"
                  >
                    <Trans>Email Address</Trans>
                  </Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t`user@stackbluff.com`}
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
                          {field.state.meta.errors
                            .map((e) => (typeof e === 'string' ? e : e?.message || 'Invalid'))
                            .join(', ')}
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
              {mutation.isPending ? t`SENDING...` : t`SEND RESET LINK`}
            </LiquidMetalButton>

            <div className="text-center pt-4">
              <Link
                to="/login"
                className="font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface transition-all tracking-widest uppercase"
              >
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
