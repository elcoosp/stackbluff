import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { authApi } from '@stackbluff/shared/auth/api';
import { setToken } from '@stackbluff/shared/auth/token';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Mail, User } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trackGameEvent } from '@/lib/customAnalytics';

const step1Schema = z.object({
  username: z.string().min(3, t`Username must be at least 3 characters`),
});
const step2Schema = z.object({ email: z.string().email(t`Invalid email address`) });
const step3Schema = z.object({
  password: z.string().min(8, t`Password must be at least 8 characters`),
});

export const Route = createFileRoute('/register')({
  beforeLoad: () => {
    if (useAuthStore.getState().user) throw redirect({ to: '/' });
  },
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState(1);
  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setToken(data.token);
      setAuth(data.user, data.token, data.balance || 0);
      trackGameEvent('registration_success', { platform: 'email' });
      navigate({ to: '/' });
    },
    onError: (error) => {
      toast.error(error.message || t`Registration failed`);
    },
  });
  const form = useForm({
    defaultValues: { username: '', email: '', password: '' },
    validators: { onChange: step1Schema.and(step2Schema).and(step3Schema) },
    onSubmit: ({ value }) => mutation.mutate(value),
  });

  const nextStep = async () => {
    let errs: any[] = [];
    if (step === 1) errs = await form.validateField('username', 'change');
    else if (step === 2) errs = await form.validateField('email', 'change');
    if (errs.length === 0) setStep(step + 1);
  };
  const prevStep = () => setStep(step - 1);
  const getErrorMessage = (err: any) => {
    if (typeof err === 'string') return err;
    if (err?.message) return err.message;
    return t`Validation error`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter">
            <Trans>STACKBLUFF</Trans>
          </h1>
          <p className="font-data-mono text-xs text-outline mt-2 tracking-widest">
            <Trans>CREATE ACCOUNT</Trans>
          </p>
        </div>
        <GlassPanel>
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-primary' : 'bg-outline-variant'}`}
              />
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 3) form.handleSubmit();
              else nextStep();
            }}
            className="space-y-6"
          >
            {step === 1 && (
              <form.Field name="username">
                {(field) => (
                  <div className="space-y-2">
                    <Label
                      htmlFor="username"
                      className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase"
                    >
                      <Trans>Username</Trans>
                    </Label>
                    <div className="relative mt-2">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="username"
                        type="text"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={t`PLAYER_01`}
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
                            {field.state.meta.errors.map((e: any) => getErrorMessage(e)).join(', ')}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </form.Field>
            )}

            {step === 2 && (
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
                            {field.state.meta.errors.map((e: any) => getErrorMessage(e)).join(', ')}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </form.Field>
            )}

            {step === 3 && (
              <form.Field name="password">
                {(field) => (
                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase"
                    >
                      <Trans>Password</Trans>
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
                            {field.state.meta.errors.map((e: any) => getErrorMessage(e)).join(', ')}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </form.Field>
            )}

            <form.Subscribe
              selector={(state) => [
                state.values.username,
                state.values.email,
                state.values.password,
              ]}
            >
              {([username, email, password]) => {
                const current = step === 1 ? username : step === 2 ? email : password;
                const currentSchema =
                  step === 1 ? step1Schema : step === 2 ? step2Schema : step3Schema;
                const canContinue = currentSchema.safeParse({
                  [step === 1 ? 'username' : step === 2 ? 'email' : 'password']: current,
                }).success;

                return (
                  <div
                    className={`flex items-center gap-2 pt-4 ${
                      step > 1 ? 'justify-between' : 'justify-end'
                    }`}
                  >
                    {step > 1 && (
                      <LiquidMetalButton
                        type="button"
                        onClick={prevStep}
                        variant="silver"
                        className="flex-1 md:flex-none px-6 text-[10px] whitespace-nowrap"
                      >
                        <Trans>BACK</Trans>
                      </LiquidMetalButton>
                    )}
                    {step < 3 ? (
                      <LiquidMetalButton
                        type="button"
                        onClick={nextStep}
                        disabled={!canContinue}
                        variant="silver"
                        className={
                          step > 1
                            ? 'flex-1 md:flex-none px-6 text-[10px] whitespace-nowrap'
                            : 'px-6'
                        }
                      >
                        <Trans>CONTINUE</Trans>
                      </LiquidMetalButton>
                    ) : (
                      <LiquidMetalButton
                        type="submit"
                        disabled={mutation.isPending || !canContinue}
                        variant="silver"
                        className="flex-1 text-[10px] whitespace-nowrap"
                      >
                        {mutation.isPending ? t`INITIALIZING...` : t`CREATE ACCOUNT`}
                      </LiquidMetalButton>
                    )}
                  </div>
                );
              }}
            </form.Subscribe>
            <div className="text-center pt-4">
              <Link
                to="/login"
                className="font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface transition-all tracking-widest uppercase"
              >
                <Trans>
                  ALREADY HAVE AN ACCOUNT? <span className="text-tertiary">SIGN IN</span>
                </Trans>
              </Link>
            </div>
          </form>
        </GlassPanel>

        <div className="flex flex-wrap gap-4 justify-center text-sm text-on-surface-variant mt-6">
          <Link to="/legal/terms" className="hover:text-tertiary transition-colors">
            <Trans>Terms of Service</Trans>
          </Link>
          <span className="text-white/20">|</span>
          <Link to="/legal/privacy" className="hover:text-tertiary transition-colors">
            <Trans>Privacy Policy</Trans>
          </Link>
          <span className="text-white/20">|</span>
          <Link to="/responsible-gaming" className="hover:text-tertiary transition-colors">
            <Trans>Responsible Gaming</Trans>
          </Link>
        </div>
      </div>
    </div>
  );
}
