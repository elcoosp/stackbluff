import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { z } from 'zod';
import { authApi } from '@stackbluff/shared/auth/api';
import { setToken } from '@stackbluff/shared/auth/token';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { Link } from '@tanstack/react-router';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    // If already authenticated, redirect to lobby
    if (useAuthStore.getState().user) {
      throw redirect({ to: '/' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const loginMutation = useMutation({
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
    onSubmit: ({ value }) => loginMutation.mutate(value),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
      <div className="absolute inset-0 carbon-texture opacity-5 pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter">STACKBLUFF</h1>
          <p className="font-data-mono text-xs text-tertiary mt-2 tracking-widest">SECURE LOGIN</p>
        </div>
        <GlassPanel>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <form.Field name="username">
              {(field) => (
                <div className="space-y-2">
                  <label className="block font-label-caps text-[10px] text-outline tracking-wider uppercase">
                    Username or Email
                  </label>
                  <div className="relative border border-outline-variant/50 rounded-lg bg-black/40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">
                      <span className="material-symbols-outlined text-base">person</span>
                    </span>
                    <input
                      type="text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="w-full bg-transparent py-3 pl-10 pr-4 text-on-surface font-data-mono text-sm focus:outline-none focus:ring-1 focus:ring-tertiary rounded-lg"
                      placeholder="ID / EMAIL"
                    />
                  </div>
                  {field.state.meta.errors.map((err) => (
                    <p key={err} className="text-error text-xs font-mono mt-1">{err}</p>
                  ))}
                </div>
              )}
            </form.Field>
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <label className="block font-label-caps text-[10px] text-outline tracking-wider uppercase">
                    Password
                  </label>
                  <div className="relative border border-outline-variant/50 rounded-lg bg-black/40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">
                      <span className="material-symbols-outlined text-base">lock</span>
                    </span>
                    <input
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="w-full bg-transparent py-3 pl-10 pr-4 text-on-surface font-data-mono text-sm focus:outline-none focus:ring-1 focus:ring-tertiary rounded-lg"
                      placeholder="••••••••"
                    />
                  </div>
                  {field.state.meta.errors.map((err) => (
                    <p key={err} className="text-error text-xs font-mono mt-1">{err}</p>
                  ))}
                </div>
              )}
            </form.Field>
            <LiquidMetalButton
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full"
            >
              {loginMutation.isPending ? 'AUTHENTICATING...' : 'SIGN IN'}
            </LiquidMetalButton>
            {loginMutation.error && (
              <p className="text-error text-xs font-mono text-center">
                {loginMutation.error.message}
              </p>
            )}
            <div className="text-center pt-4">
              <Link
                to="/register"
                className="font-label-caps text-[10px] text-outline hover:text-tertiary transition-all tracking-widest uppercase"
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
