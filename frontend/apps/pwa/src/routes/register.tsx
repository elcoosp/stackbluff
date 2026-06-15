import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useState } from 'react';
import { authApi } from '@stackbluff/shared/auth/api';
import { setToken } from '@stackbluff/shared/auth/token';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { GlassPanel } from '@stackbluff/shared/ui/GlassPanel';
import { LiquidMetalButton } from '@stackbluff/shared/ui/LiquidMetalButton';
import { Link } from '@tanstack/react-router';
import { User, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner'; // Added Sonner import

const step1Schema = z.object({ username: z.string().min(3, 'Username must be at least 3 characters') });
const step2Schema = z.object({ email: z.string().email('Invalid email address') });
const step3Schema = z.object({ password: z.string().min(8, 'Password must be at least 8 characters') });

export const Route = createFileRoute('/register')({
  beforeLoad: () => { if (useAuthStore.getState().user) throw redirect({ to: '/' }); },
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState(1);
  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => { setToken(data.token); setAuth(data.user, data.token); navigate({ to: '/' }); },
    onError: (error) => {
      // Trigger toast with fallback message (e.g., "Email already exists")
      toast.error(error.message || 'Registration failed');
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
  const getErrorMessage = (err: any) => { if (typeof err === 'string') return err; if (err?.message) return err.message; return 'Validation error'; };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1b1e_0%,_#0a0a0a_100%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display-lg text-4xl text-on-surface uppercase tracking-tighter">STACKBLUFF</h1>
          <p className="font-data-mono text-xs text-outline mt-2 tracking-widest">CREATE ACCOUNT</p>
        </div>
        <GlassPanel>
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map(i => <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-primary' : 'bg-outline-variant'}`} />)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (step === 3) form.handleSubmit(); else nextStep(); }} className="space-y-6">
            {step === 1 && (
              <form.Field name="username">
                {(field) => (
                  <div className="space-y-2">
                    <label className="block font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">Username</label>
                    <div className="input-field">
                      <span className="input-icon"><User size={16} /></span>
                      <input type="text" value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} className="text-on-surface placeholder:text-outline-variant/50" placeholder="PLAYER_01" />
                    </div>
                    <div className={`min-h-[1.25rem] mt-1 transition-all duration-300 ${field.state.meta.errors.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}>
                      <p className="field-error">{field.state.meta.errors.map((e: any) => getErrorMessage(e)).join(', ') || '\u00A0'}</p>
                    </div>
                  </div>
                )}
              </form.Field>
            )}
            {step === 2 && (
              <form.Field name="email">
                {(field) => (
                  <div className="space-y-2">
                    <label className="block font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">Email Address</label>
                    <div className="input-field">
                      <span className="input-icon"><Mail size={16} /></span>
                      <input type="email" value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} className="text-on-surface placeholder:text-outline-variant/50" placeholder="user@stackbluff.com" />
                    </div>
                    <div className={`min-h-[1.25rem] mt-1 transition-all duration-300 ${field.state.meta.errors.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}>
                      <p className="field-error">{field.state.meta.errors.map((e: any) => getErrorMessage(e)).join(', ') || '\u00A0'}</p>
                    </div>
                  </div>
                )}
              </form.Field>
            )}
            {step === 3 && (
              <form.Field name="password">
                {(field) => (
                  <div className="space-y-2">
                    <label className="block font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">Password</label>
                    <div className="input-field">
                      <span className="input-icon"><Lock size={16} /></span>
                      <input type="password" value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} className="text-on-surface placeholder:text-outline-variant/50" placeholder="••••••••" />
                    </div>
                    <div className={`min-h-[1.25rem] mt-1 transition-all duration-300 ${field.state.meta.errors.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}>
                      <p className="field-error">{field.state.meta.errors.map((e: any) => getErrorMessage(e)).join(', ') || '\u00A0'}</p>
                    </div>
                  </div>
                )}
              </form.Field>
            )}
            <form.Subscribe selector={(state) => [state.values.username, state.values.email, state.values.password]}>
              {([username, email, password]) => {
                const current = step === 1 ? username : step === 2 ? email : password;
                const currentSchema = step === 1 ? step1Schema : step === 2 ? step2Schema : step3Schema;
                const canContinue = currentSchema.safeParse({ [step === 1 ? 'username' : step === 2 ? 'email' : 'password']: current }).success;

                return (
                  <div className="flex justify-between pt-4">
                    {step > 1 && <LiquidMetalButton type="button" onClick={prevStep} variant="silver" className="w-auto px-6">BACK</LiquidMetalButton>}
                    <div className="flex-grow" />
                    {step < 3 ? (
                      <LiquidMetalButton type="button" onClick={nextStep} disabled={!canContinue} variant="silver" className="w-auto px-6">
                        CONTINUE
                      </LiquidMetalButton>
                    ) : (
                      <LiquidMetalButton type="submit" disabled={mutation.isPending || !canContinue} variant="silver">
                        {mutation.isPending ? 'INITIALIZING...' : 'CREATE ACCOUNT'}
                      </LiquidMetalButton>
                    )}
                  </div>
                );
              }}
            </form.Subscribe>
            {/* REMOVED the inline mutation error div here */}
            <div className="text-center pt-4">
              <Link to="/login" className="font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface transition-all tracking-widest uppercase">
                ALREADY HAVE AN ACCOUNT? <span className="text-tertiary">SIGN IN</span>
              </Link>
            </div>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}
