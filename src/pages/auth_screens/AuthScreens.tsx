import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { UserRole as DatabaseUserRole } from '@/types/database';
import { AlertCircle, Eye, EyeOff, Info, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXCHANGE_STEPS } from '@/lib/exchangeStatus';

export default function AuthScreens() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showContactAdmin, setShowContactAdmin] = useState(false);
  const navigate = useNavigate();
  const { setUser, setOriginalAdminUser } = useUser();
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Form validation
    if (!email || !password) {
      setError('Email and password are required');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Sign in with Supabase Auth
      await signIn(email, password);

      // 2. Get the auth user ID from the active session (avoids relying on email match)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError('Sign in failed. Please try again.');
        setIsLoading(false);
        return;
      }

      // 3. Fetch profile by ID — more reliable than by email with RLS policies
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError || !profile) {
        setError('Login successful, but your profile was not found. Please contact your administrator to ensure your account is fully set up.');
        setIsLoading(false);
        return;
      }

      // 4. Sync with UserContext for current APP navigation logic
      const typedProfile = profile as {
        id: string;
        full_name: string | null;
        email: string;
        role: DatabaseUserRole;
      };

      const userFromProfile = {
        id: typedProfile.id,
        name: typedProfile.full_name || 'User',
        email: typedProfile.email,
        role: typedProfile.role
      };

      setUser(userFromProfile);

      // If Admin, also set original admin for switching logic support
      if (typedProfile.role === 'ADMIN') {
        setOriginalAdminUser(userFromProfile);
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Auth error:', err);
      const e = err as { message?: string; status?: number };
      const msg: string = e.message || '';
      if (msg.includes('Invalid login credentials') || e.status === 400) {
        setError('Incorrect email or password. If you need access, contact your administrator to ensure your account exists in the system.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Your account email is not confirmed. Please contact your administrator.');
      } else {
        setError(msg || 'Sign in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-card lg:grid-cols-2">
      {/* Form panel */}
      <main className="flex min-h-screen flex-col px-4 py-8 sm:px-10 lg:px-16 xl:px-24">
        <div className="flex items-center gap-2.5">
          <img src="/Vector-Blue-KOTU-Logo.png" alt="KOTU" className="size-8 rounded-full" />
          <span className="text-sm font-medium text-foreground">
            KOTU <span className="text-muted-foreground">·</span> Exchange portal
          </span>
        </div>

        <div className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-sm animate-fade-in lg:mx-0">
            <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-[28px] sm:leading-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to manage exchanges, returns and shipments.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Work email</Label>
                <Input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@kotu.co.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  aria-invalid={!!error || undefined}
                  className="h-10 text-base md:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="login-password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowContactAdmin((v) => !v)}
                    aria-expanded={showContactAdmin}
                    aria-controls="forgot-password-note"
                    className="rounded text-sm font-medium text-primary transition-colors duration-150 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    aria-invalid={!!error || undefined}
                    className="h-10 pr-10 text-base md:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {showContactAdmin && (
                <div
                  id="forgot-password-note"
                  role="status"
                  className="flex items-start gap-2.5 rounded-lg bg-accent px-3 py-2.5 text-sm text-accent-foreground animate-fade-in"
                >
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p className="flex-1">
                    <span className="font-medium">Contact your administrator.</span>{' '}
                    Passwords are reset by an admin from Users &amp; roles.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowContactAdmin(false)}
                    aria-label="Dismiss"
                    className="-m-1 grid size-6 shrink-0 place-items-center rounded-md transition-colors hover:bg-primary/10"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="animate-spin" />}
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>

              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-fade-in">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>{error}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">You'll stay signed in on this device until you sign out.</p>
            </form>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Need access? Ask your admin to add you from Users &amp; roles.
        </p>
      </main>

      {/* Brand panel (desktop only) */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:items-center" aria-hidden>
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary-foreground/5" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-primary-foreground/5" />

        <div className="relative w-full max-w-lg px-12 xl:px-16">
          <p className="font-heading text-2xl font-semibold leading-snug xl:text-[28px]">
            Every exchange — from request to refund — in one place.
          </p>
          <p className="mt-3 text-sm text-primary-foreground/70">
            Support, warehouse and finance work from the same record, so nothing falls between teams.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-4">
              <p className="text-xs text-primary-foreground/70">Steps, one timeline</p>
              <p className="mt-1 font-heading text-2xl font-semibold tabular">{EXCHANGE_STEPS.length}</p>
              <p className="mt-1 text-xs text-primary-foreground/70">Request to close</p>
            </div>
            <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-4">
              <p className="text-xs text-primary-foreground/70">Teams, one queue each</p>
              <p className="mt-1 font-heading text-2xl font-semibold tabular">4</p>
              <p className="mt-1 text-xs text-primary-foreground/70">Admin · Support · Warehouse · Finance</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-4">
            <p className="text-xs text-primary-foreground/70">The exchange journey</p>
            <ol className="mt-3 flex flex-wrap gap-1.5">
              {EXCHANGE_STEPS.map((s, i) => (
                <li
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 py-0.5 pl-0.5 pr-2.5 text-xs"
                >
                  <span className="grid size-5 place-items-center rounded-full bg-primary-foreground text-[11px] font-semibold text-primary tabular">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>
    </div>
  );
}
