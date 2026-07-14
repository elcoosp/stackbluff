import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { authApi } from '@stackbluff/shared/auth/api';
import { setToken } from '@stackbluff/shared/auth/token';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { Link } from '@tanstack/react-router';
import { Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { isAccountLocked, getLockoutRemaining, clearLockout } from '@/lib/errorHandler';
import { trackGameEvent } from '@/lib/customAnalytics';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

const loginSchema = z.object({
  email: z.string().min(1, t`Email is required`).email(t`Invalid email address`),
  password: z.string().min(1, t`Password is required`),
});

export const Route = createFileRoute('/login')({
  beforeLoad: () => { if (useAuthStore.getState().user) throw redirect({ to: '/' }); },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isMiniApp = typeof window !== 'undefined' && !!window.Telegram?.WebApp;

  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isAccountLocked()) {
      const update = () => {
        const remaining = getLockoutRemaining();
        setLockoutSeconds(remaining);
        if (remaining <= 0) {
          if (interval) clearInterval(interval);
          clearLockout();
        }
      };
      update();
      interval = setInterval(update, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setToken(data.token);
      setAuth(data.user, data.token, data.balance || 0);
      trackGameEvent('login_success', { platform: 'email' });
      navigate({ to: '/' });
    },
    onError: (error) => {
      toast.error(error.message || t`Invalid credentials`);
    },
  });

  const telegramMutation = useMutation({
    mutationFn: authApi.telegramAuth,
    onSuccess: (data) => {
      setToken(data.token);
      setAuth(data.user, data.token, data.balance || 0);
      trackGameEvent('login_success', { platform: 'telegram' });
      navigate({ to: '/' });
    },
    onError: (error) => {
      toast.error(error.message || t`Telegram authentication failed`);
    },
  });

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onChange: loginSchema },
    onSubmit: ({ value }) => loginMutation.mutate(value),
  });

  const handleTelegramLogin = () => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) {
      toast.error(t`Telegram environment not detected or initData missing`);
      return;
    }
    telegramMutation.mutate(initData);
  };

  const isLocked = isAccountLocked();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter"><Trans>STACKBLUFF</Trans></h1>
          <p className="font-data-mono text-xs text-outline mt-2 tracking-widest"><Trans>SECURE LOGIN</Trans></p>
        </div>
        <GlassPanel>
          <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }} className="space-y-6">
            {isMiniApp && (
              <div className="space-y-4">
                <LiquidMetalButton
                  type="button"
                  onClick={handleTelegramLogin}
                  disabled={telegramMutation.isPending}
                  variant="emerald"
                  className="w-full"
                >
                  {telegramMutation.isPending ? t`AUTHENTICATING...` : t`LOGIN WITH TELEGRAM`}
                </LiquidMetalButton>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-black/60 px-2 text-on-surface-variant"><Trans>or</Trans></span>
                  </div>
                </div>
              </div>
            )}

            {!isMiniApp && (
              <>
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
                              {field.state.meta.errors.map((e: any) => e?.message || String(e)).join(', ')}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </form.Field>

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
                              {field.state.meta.errors.map((e: any) => e?.message || String(e)).join(', ')}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </form.Field>

                {isLocked && (
                  <div className="text-center text-red-400 text-sm font-mono">
                    <Trans>Account locked. Try again in {lockoutSeconds} seconds.</Trans>
                  </div>
                )}

                <LiquidMetalButton
                  type="submit"
                  disabled={loginMutation.isPending || isLocked}
                  variant="silver"
                  className="w-full"
                >
                  {loginMutation.isPending ? t`AUTHENTICATING...` : t`SIGN IN`}
                </LiquidMetalButton>
              </>
            )}

            <div className="text-center">
              <Link to="/forgot-password" className="font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface transition-all tracking-widest uppercase">
                <Trans>FORGOT PASSWORD?</Trans>
              </Link>
            </div>

            <div className="text-center pt-2">
              <Link to="/register" className="font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface transition-all tracking-widest uppercase">
                <Trans>NEW TO STACKBLUFF? <span className="text-tertiary">CREATE ACCOUNT</span></Trans>
              </Link>
            </div>
          </form>
        </GlassPanel>

      <div className="flex flex-wrap gap-4 justify-center text-sm text-on-surface-variant mt-6">
        <Link to="/legal/terms" className="hover:text-tertiary transition-colors"><Trans>Terms of Service</Trans></Link>
        <span className="text-white/20">|</span>
        <Link to="/legal/privacy" className="hover:text-tertiary transition-colors"><Trans>Privacy Policy</Trans></Link>
        <span className="text-white/20">|</span>
        <Link to="/responsible-gaming" className="hover:text-tertiary transition-colors"><Trans>Responsible Gaming</Trans></Link>
      </div>
      </div>
    </div>
  );
}
