#!/usr/bin/env bash
set -euo pipefail

WORKTREE_DIR="../stackbluff-worktrees/issue-018-final"
BRANCH="issue/018-final"
cd "$WORKTREE_DIR/frontend"

# ----------------------------------------------------------------------
# Fix Tailwind CSS v4 and styling for login/register pages
# 1. Ensure index.css has proper theme variables and tailwind imports
# 2. Ensure components use actual Tailwind classes that exist
# ----------------------------------------------------------------------

for app in mini-app pwa; do
  # Correct index.css with theme variables and light text by default
  cat > "apps/$app/src/index.css" << 'CSS'
@import "tailwindcss";

@theme {
  --color-background: #131313;
  --color-foreground: #e2e2e2;
  --color-card: #1f1f1f;
  --color-card-foreground: #e2e2e2;
  --color-primary: #c6c6cf;
  --color-primary-foreground: #2f3037;
  --color-secondary: #c7c6c9;
  --color-secondary-foreground: #303033;
  --color-accent: #4edea3;
  --color-accent-foreground: #003824;
  --color-destructive: #ffb4ab;
  --color-destructive-foreground: #690005;
  --color-border: #353535;
  --color-ring: #4edea3;
  --radius: 0.5rem;
}

@layer base {
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
  }
}

@layer components {
  .glass-hub {
    backdrop-filter: blur(16px);
    background: rgba(10, 10, 10, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  }
  .card-back {
    background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    position: relative;
    overflow: hidden;
  }
  .card-back::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(78, 222, 163, 0.05) 2px, rgba(78, 222, 163, 0.05) 4px);
  }
}
CSS

  # Update GlassPanel component to use explicit background and text colors
  cat > "apps/$app/src/routes/login.tsx" << 'LOGIN'
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
import { User, Lock } from 'lucide-react';

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
          <h1 className="font-display-lg text-4xl text-foreground uppercase tracking-tighter">STACKBLUFF</h1>
          <p className="font-data-mono text-xs text-accent mt-2 tracking-widest">SECURE LOGIN</p>
        </div>
        <GlassPanel>
          <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }} className="space-y-6">
            <form.Field name="username">
              {(field) => (
                <div className="space-y-2">
                  <label className="block font-label-caps text-[10px] text-foreground/70 tracking-wider uppercase">Username or Email</label>
                  <div className="relative border border-border rounded-lg bg-black/40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50">
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="w-full bg-transparent py-3 pl-10 pr-4 text-foreground font-data-mono text-sm focus:outline-none focus:ring-1 focus:ring-accent rounded-lg placeholder:text-foreground/30"
                      placeholder="ID / EMAIL"
                    />
                  </div>
                  {field.state.meta.errors.map((err) => (
                    <p key={err} className="text-destructive text-xs font-mono mt-1">{err}</p>
                  ))}
                </div>
              )}
            </form.Field>
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <label className="block font-label-caps text-[10px] text-foreground/70 tracking-wider uppercase">Password</label>
                  <div className="relative border border-border rounded-lg bg-black/40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50">
                      <Lock size={16} />
                    </span>
                    <input
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="w-full bg-transparent py-3 pl-10 pr-4 text-foreground font-data-mono text-sm focus:outline-none focus:ring-1 focus:ring-accent rounded-lg placeholder:text-foreground/30"
                      placeholder="••••••••"
                    />
                  </div>
                  {field.state.meta.errors.map((err) => (
                    <p key={err} className="text-destructive text-xs font-mono mt-1">{err}</p>
                  ))}
                </div>
              )}
            </form.Field>
            <LiquidMetalButton type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? 'AUTHENTICATING...' : 'SIGN IN'}
            </LiquidMetalButton>
            {mutation.error && <p className="text-destructive text-xs font-mono text-center">{mutation.error.message}</p>}
            <div className="text-center pt-4">
              <Link
                to="/register"
                className="font-label-caps text-[10px] text-foreground/70 hover:text-accent transition-all tracking-widest uppercase"
              >
                NEW TO STACKBLUFF? <span className="text-accent">CREATE ACCOUNT</span>
              </Link>
            </div>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}
LOGIN
done

# ----------------------------------------------------------------------
# Rebuild with Vite (no cache)
# ----------------------------------------------------------------------
rm -rf apps/*/dist node_modules/.vite
pnpm install --no-frozen-lockfile
pnpm build

cd ..
git add frontend/
git commit -m "fix(styles): restore Obsidian Steel colors with proper text visibility" || true
git push --force-with-lease origin "$BRANCH"

echo "✅ Fixed black-on-black issue. Text now uses --color-foreground (light gray) on dark background."
