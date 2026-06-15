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
import { User, Lock } from 'lucide-react';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
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
    onSuccess: (data) => { setToken(data.token); setAuth(data.user, data.token); navigate({ to: '/' }); },
  });
  const form = useForm({
    defaultValues: { username: '', password: '' },
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
            <form.Field name="username">
              {(field) => (
                <div className="space-y-2">
                  <label className="block font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">Username or Email</label>
                  <div className="input-field">
                    <span className="input-icon"><User size={16} /></span>
                    <input type="text" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className="text-on-surface placeholder:text-outline-variant/50" placeholder="ID / EMAIL" />
                  </div>
                  {field.state.meta.errors.length > 0 && <div className="field-error">{field.state.meta.errors.map((e: any) => e?.message || String(e)).join(', ')}</div>}
                </div>
              )}
            </form.Field>
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <label className="block font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">Password</label>
                  <div className="input-field">
                    <span className="input-icon"><Lock size={16} /></span>
                    <input type="password" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className="text-on-surface placeholder:text-outline-variant/50" placeholder="••••••••" />
                  </div>
                  {field.state.meta.errors.length > 0 && <div className="field-error">{field.state.meta.errors.map((e: any) => e?.message || String(e)).join(', ')}</div>}
                </div>
              )}
            </form.Field>
            <LiquidMetalButton type="submit" disabled={mutation.isPending} variant="silver" className="w-full">
              {mutation.isPending ? 'AUTHENTICATING...' : 'SIGN IN'}
            </LiquidMetalButton>
            {mutation.error && <div className="field-error text-center">{mutation.error.message}</div>}
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
