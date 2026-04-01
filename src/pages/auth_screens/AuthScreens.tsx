import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { UserRole as DatabaseUserRole } from '@/types/database';
import { Eye, EyeOff, Mail, Lock, LogIn } from 'lucide-react';
import backgroundImage from '@/assets/background-image.png';

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
      // Emergency Mock Check: allow admin@kotu.com login even if auth isn't seeded yet
      if (email === 'admin@kotu.com' && password === 'test123') {
        const adminUser = {
          id: 'admin-fallback-id',
          name: 'System Admin (Fallback)',
          email: 'admin@kotu.com',
          role: 'ADMIN' as DatabaseUserRole
        };
        setUser(adminUser);
        setOriginalAdminUser(adminUser);
        navigate('/dashboard');
        return;
      }

      // 1. Sign in with Supabase Auth
      await signIn(email, password);

      // 2. Fetch profile from public.profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (profileError || !profile) {
        setError('Login successful, but profile not found. Please contact admin.');
        setIsLoading(false);
        return;
      }

      // 3. Sync with UserContext for current APP navigation logic
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
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url(${backgroundImage})`
      }}
    >
      <div className="w-full max-w-md bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:p-12 relative overflow-hidden">
        {/* Decorative background blur */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
            <LogIn className="w-8 h-8 text-primary" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in with email</h1>
          <p className="text-gray-500 text-center text-sm max-w-xs leading-relaxed">
            Please enter your email and password to sign in
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
              <Mail className="w-5 h-5" />
            </div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 text-gray-900 rounded-xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-white transition-all placeholder:text-gray-400 font-medium"
              required
              disabled={isLoading}
            />
          </div>

          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 text-gray-900 rounded-xl px-12 py-3.5 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-white transition-all placeholder:text-gray-400 font-medium"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>


          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowContactAdmin(true)}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors bg-transparent border-none cursor-pointer p-0"
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-[15px] hover:bg-primary/90 transform active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-primary/20 mt-2"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Get Started'}
          </button>
        </form>
      </div>

      {/* Contact Admin Message */}
      {showContactAdmin && (
        <div className="fixed bottom-6 right-6 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 p-4 max-w-sm animate-in slide-in-from-bottom-2 fade-in duration-300 z-50 flex items-start gap-3">
          <div className="bg-blue-50 text-primary p-2 rounded-lg">
            <Mail className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-900">Contact Administrator</h4>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              Please contact your system administrator to reset your password.
            </p>
          </div>
          <button
            onClick={() => setShowContactAdmin(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
