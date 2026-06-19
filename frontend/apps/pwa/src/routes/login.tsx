import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
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

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const Route = createFileRoute('/login')({
  beforeLoad: () => { if (useAuthStore.getState().user) throw redirect({ to: '/' }); },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setToken(data.token);
      setAuth(data.user, data.token, data.balance || 0);
      navigate({ to: '/' });
    },
    onError: (error) => {
      toast.error(error.message || 'Invalid credentials');
    },
  });
  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onChange: loginSchema },
    onSubmit: ({ value }) => mutation.mutate(value),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter">STACKBLUFF</h1>
          <p className="font-data-mono text-xs text-outline mt-2 tracking-widest">SECURE LOGIN</p>
        </div>
        <GlassPanel>
          <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }} className="space-y-6">
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase"
                  >
                    Email Address
                  </Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="user@stackbluff.com"
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
                    Password
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

            <LiquidMetalButton type="submit" disabled={mutation.isPending} variant="silver" className="w-full">
              {mutation.isPending ? 'AUTHENTICATING...' : 'SIGN IN'}
            </LiquidMetalButton>

            <div className="text-center pt-4">
              <Link to="/register" className="font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface transition-all tracking-widest uppercase">
                NEW TO STACKBLUFF? <span className="text-tertiary">CREATE ACCOUNT</span>
              </Link>
            </div>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}
