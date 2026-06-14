import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { z } from 'zod';
import { useState } from 'react';
import { authApi } from '@stackbluff/shared/auth/api';
import { setToken } from '@stackbluff/shared/auth/token';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { Link } from '@tanstack/react-router';

const step1Schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
});
const step2Schema = z.object({
  email: z.string().email('Invalid email address'),
});
const step3Schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const fullSchema = step1Schema.and(step2Schema).and(step3Schema);

export const Route = createFileRoute('/register')({
  beforeLoad: () => {
    if (useAuthStore.getState().user) {
      throw redirect({ to: '/' });
    }
  },
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [step, setStep] = useState(1);
  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setToken(data.token);
      setAuth(data.user, data.token);
      navigate({ to: '/' });
    },
  });

  const form = useForm({
    defaultValues: { username: '', email: '', password: '' },
    validatorAdapter: zodValidator(),
    validators: { onChange: fullSchema },
    onSubmit: ({ value }) => registerMutation.mutate(value),
  });

  const nextStep = async () => {
    let isValid = false;
    if (step === 1) isValid = await form.validateField('username');
    else if (step === 2) isValid = await form.validateField('email');
    if (isValid) setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
      <div className="absolute inset-0 carbon-texture opacity-5 pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter">STACKBLUFF</h1>
          <p className="font-data-mono text-xs text-tertiary mt-2 tracking-widest">CREATE ACCOUNT</p>
        </div>
        <GlassPanel>
          {/* Progress indicators */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  i <= step ? 'bg-tertiary' : 'bg-outline-variant'
                }`}
              />
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 3) form.handleSubmit();
            }}
            className="space-y-6"
          >
            {step === 1 && (
              <form.Field name="username">
                {(field) => (
                  <div className="space-y-2">
                    <label className="block font-label-caps text-[10px] text-outline tracking-wider uppercase">
                      Username
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
                        placeholder="PLAYER_01"
                      />
                    </div>
                    {field.state.meta.errors.map((err) => (
                      <p key={err} className="text-error text-xs font-mono mt-1">{err}</p>
                    ))}
                  </div>
                )}
              </form.Field>
            )}

            {step === 2 && (
              <form.Field name="email">
                {(field) => (
                  <div className="space-y-2">
                    <label className="block font-label-caps text-[10px] text-outline tracking-wider uppercase">
                      Email Address
                    </label>
                    <div className="relative border border-outline-variant/50 rounded-lg bg-black/40">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">
                        <span className="material-symbols-outlined text-base">alternate_email</span>
                      </span>
                      <input
                        type="email"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="w-full bg-transparent py-3 pl-10 pr-4 text-on-surface font-data-mono text-sm focus:outline-none focus:ring-1 focus:ring-tertiary rounded-lg"
                        placeholder="user@stackbluff.com"
                      />
                    </div>
                    {field.state.meta.errors.map((err) => (
                      <p key={err} className="text-error text-xs font-mono mt-1">{err}</p>
                    ))}
                  </div>
                )}
              </form.Field>
            )}

            {step === 3 && (
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
            )}

            <div className="flex justify-between pt-4">
              {step > 1 && (
                <LiquidMetalButton type="button" onClick={prevStep} className="w-auto px-6">
                  BACK
                </LiquidMetalButton>
              )}
              <div className="flex-grow" />
              {step < 3 ? (
                <LiquidMetalButton type="button" onClick={nextStep} className="w-auto px-6">
                  CONTINUE
                </LiquidMetalButton>
              ) : (
                <LiquidMetalButton type="submit" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? 'INITIALIZING...' : 'CREATE ACCOUNT'}
                </LiquidMetalButton>
              )}
            </div>

            {registerMutation.error && (
              <p className="text-error text-xs font-mono text-center mt-4">
                {registerMutation.error.message}
              </p>
            )}

            <div className="text-center pt-4">
              <Link
                to="/login"
                className="font-label-caps text-[10px] text-outline hover:text-tertiary transition-all tracking-widest uppercase"
              >
                ALREADY HAVE AN ACCOUNT? <span className="text-tertiary">SIGN IN</span>
              </Link>
            </div>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}
