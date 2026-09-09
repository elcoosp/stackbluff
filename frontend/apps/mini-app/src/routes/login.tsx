import { authApi } from '@stackbluff/shared/auth/api';
import { setToken } from '@stackbluff/shared/auth/token';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { Lock, User } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (useAuthStore.getState().user) throw redirect({ to: '/' });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setToken(data.token);
      setAuth(data.user, data.token);
      navigate({ to: '/' });
    },
  });
  const form = useForm({
    defaultValues: { username: '', password: '' },
    validatorAdapter: zodValidator(),
    validators: { onChange: loginSchema },
    onSubmit: ({ value }) => mutation.mutate(value),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter">
            STACKBLUFF
          </h1>
          <p className="font-data-mono text-xs text-tertiary mt-2 tracking-widest">SECURE LOGIN</p>
        </div>
        <GlassPanel>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <form.Field name="username">
              {(field) => (
                <div className="space-y-2">
                  <label className="block font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
                    Username or Email
                  </label>
                  <div className="relative border border-outline-variant/50 rounded-lg bg-black/40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="w-full bg-transparent py-3 pl-10 pr-4 text-on-surface font-data-mono text-sm focus:outline-none focus:ring-1 focus:ring-tertiary rounded-lg placeholder:text-outline-variant/50"
                      placeholder="ID / EMAIL"
                    />
                  </div>
                  {field.state.meta.errors.map((err) => (
                    <p key={err} className="text-error text-xs font-mono mt-1">
                      {err}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <label className="block font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
                    Password
                  </label>
                  <div className="relative border border-outline-variant/50 rounded-lg bg-black/40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">
                      <Lock size={16} />
                    </span>
                    <input
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="w-full bg-transparent py-3 pl-10 pr-4 text-on-surface font-data-mono text-sm focus:outline-none focus:ring-1 focus:ring-tertiary rounded-lg placeholder:text-outline-variant/50"
                      placeholder="••••••••"
                    />
                  </div>
                  {field.state.meta.errors.map((err) => (
                    <p key={err} className="text-error text-xs font-mono mt-1">
                      {err}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
            <LiquidMetalButton type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? 'AUTHENTICATING...' : 'SIGN IN'}
            </LiquidMetalButton>
            {mutation.error && (
              <p className="text-error text-xs font-mono text-center">{mutation.error.message}</p>
            )}
            <div className="text-center pt-4">
              <Link
                to="/register"
                className="font-label-caps text-[10px] text-on-surface-variant hover:text-tertiary transition-all tracking-widest uppercase"
              >
                NEW TO STACKBLUFF? <span className="text-tertiary">CREATE ACCOUNT</span>
              </Link>
            </div>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}
