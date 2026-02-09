import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';
import { mockUsers } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import type { UserRole as DatabaseUserRole, Profile } from '@/types/database';
import { Facebook, Chrome, Linkedin, Eye, EyeOff } from 'lucide-react';
import backgroundSvg from '@/assets/Background image for portral.png';

export default function AuthScreens() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<DatabaseUserRole | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { setUser, setOriginalAdminUser } = useUser();

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

    if (isSignUp && !fullName.trim()) {
      setError('Full name is required for signup');
      setIsLoading(false);
      return;
    }

    if (isSignUp && !selectedRole) {
      setError('Please select a role for signup');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Handle sign up logic - create new user profile
        try {
          // Create new user profile directly (let database handle uniqueness)
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              email: email,
              full_name: fullName,
              role: selectedRole || 'SUPPORT' // Fallback to SUPPORT if somehow empty
            } as any) // Type assertion to bypass strict typing
            .select()
            .single();

          if (insertError) {
            console.error('Profile creation error:', insertError);
            
            // Check for unique constraint violation
            if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
              setError('An account with this email already exists');
            } else if (insertError.code === 'PGRST116') {
              setError('Database setup incomplete. Please contact administrator.');
            } else {
              setError('Failed to create account. Please try again.');
            }
            return;
          }

          if (newProfile) {
            // Set the user in context and navigate
            const newUser = {
              id: (newProfile as any).id,
              name: (newProfile as any).full_name || 'User',
              email: (newProfile as any).email,
              role: (newProfile as any).role as DatabaseUserRole
            };
            
            setUser(newUser);
            navigate('/dashboard');
            return;
          }
        } catch (signupErr) {
          console.error('Signup error:', signupErr);
          setError('Failed to create account. Please try again.');
          return;
        }
      } else {
        // Handle sign in logic (same as original)
        if (email === 'admin@kotu.com' && password === 'test123') {
          console.log('Using mock authentication');
          const adminUser = mockUsers.admin;
          setUser(adminUser);
          setOriginalAdminUser(adminUser);
          navigate('/dashboard');
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .single();

        if (error || !profile) {
          setError('Invalid credentials');
          return;
        }

        // Type assertion for the profile data
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
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      setError(isSignUp ? 'Sign up failed. Please try again.' : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .auth-wrapper {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 500px;
        }
        
        .auth-form-box {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 40px;
          transition: all 0.6s ease-in-out;
        }
        
        .register-form-box {
          opacity: 0;
          transform: translateX(100%);
          position: absolute;
          width: 50%;
          height: 100%;
          right: 0;
          top: 0;
        }
        
        .auth-wrapper.panel-active .register-form-box {
          opacity: 1;
          transform: translateX(0);
          z-index: 5;
          animation: show 0.6s;
        }
        
        .auth-wrapper.panel-active .login-form-box {
          transform: translateX(-100%);
          opacity: 0;
        }
        
        .login-form-box {
          z-index: 2;
        }
        
        .slide-panel-wrapper {
          position: absolute;
          top: 0;
          left: 50%;
          width: 50%;
          height: 100%;
          overflow: hidden;
          transition: transform 0.6s ease-in-out;
          z-index: 100;
        }
        
        .auth-wrapper.panel-active .slide-panel-wrapper {
          transform: translateX(-100%);
        }
        
        .slide-panel {
          background: hsl(222, 47%, 20%);
          height: 100%;
          color: white;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 40px;
          text-align: center;
        }
        
        .panel-content {
          position: absolute;
          width: 100%;
          padding: 40px;
          transition: transform 0.6s ease-in-out;
        }
        
        .panel-content-left {
          transform: translateX(-200%);
        }
        
        .auth-wrapper.panel-active .panel-content-left {
          transform: translateX(0);
        }
        
        .panel-content-right {
          transform: translateX(0);
        }
        
        .auth-wrapper.panel-active .panel-content-right {
          transform: translateX(200%);
        }
        
        .social-links {
          display: flex;
          gap: 15px;
          margin: 20px 0;
        }
        
        .social-links a {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border: 1px solid hsl(214, 32%, 91%);
          border-radius: 50%;
          color: hsl(215, 16%, 47%);
          transition: all 0.3s ease;
        }
        
        .social-links a:hover {
          background: hsl(222, 47%, 20%);
          color: white;
          border-color: hsl(222, 47%, 20%);
        }
        
        .transparent-btn {
          background: transparent;
          border: 2px solid white;
          color: white;
          padding: 12px 30px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 14px;
        }
        
        .transparent-btn:hover {
          background: white;
          color: hsl(222, 47%, 20%);
        }
        
        .mobile-switch {
          display: none;
          text-align: center;
          margin-top: 20px;
        }
        
        .mobile-switch button {
          background: none;
          border: none;
          color: hsl(199, 89%, 48%);
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
        }
        
        @keyframes show {
          0%, 49.99% {
            opacity: 0;
            z-index: 1;
          }
          50%, 100% {
            opacity: 1;
            z-index: 5;
          }
        }
        
        @media (max-width: 768px) {
          .auth-wrapper {
            grid-template-columns: 1fr;
            min-height: auto;
            max-width: 95vw;
          }
          
          .slide-panel-wrapper {
            display: none;
          }
          
          .auth-form-box {
            position: static;
            width: 100%;
            transform: none !important;
            opacity: 1 !important;
            padding: 20px;
          }
          
          .mobile-switch {
            display: block;
          }
          
          .register-form-box {
            display: none;
          }
          
          .auth-wrapper.panel-active .register-form-box {
            display: flex;
          }
          
          .auth-wrapper.panel-active .login-form-box {
            display: none;
          }
        }
        
        @media (max-width: 480px) {
          .auth-form-box {
            padding: 15px;
          }
        }
      `}} />
      <div 
        className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
        style={{
          backgroundImage: `url(${backgroundSvg})`,
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          backgroundBlendMode: 'lighten'
        }}
      >
        <div className={`auth-wrapper ${isSignUp ? 'panel-active' : ''} relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-4xl min-h-[500px]`}>
        
        {/* Login Form */}
        <div className="auth-form-box login-form-box">
          <form onSubmit={handleSubmit} className="w-full max-w-sm">
            <h1 className="text-2xl font-bold mb-6 text-center">Sign In</h1>
            
            <div className="social-links justify-center mb-4">
              <a href="#" aria-label="Facebook">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" aria-label="Google">
                <Chrome className="w-5 h-5" />
              </a>
              <a href="#" aria-label="LinkedIn">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
            
            <span className="text-muted-foreground text-sm text-center block mb-4">or use your account</span>
            
            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
                required
                disabled={isLoading}
              />
              
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <a href="#" className="text-primary text-sm block text-center mt-3 mb-4 hover:underline">
              Forgot your password?
            </a>
            
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm mb-4">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
            
            <div className="mobile-switch">
              <p className="text-muted-foreground">Don't have an account?</p>
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-primary hover:underline"
              >
                Sign Up
              </button>
            </div>
          </form>
        </div>
        
        {/* Register Form */}
        <div className="auth-form-box register-form-box">
          <form onSubmit={handleSubmit} className="w-full max-w-sm">
            <h1 className="text-2xl font-bold mb-6 text-center">Create Account</h1>
            
            <div className="social-links justify-center mb-4">
              <a href="#" aria-label="Facebook">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" aria-label="Google">
                <Chrome className="w-5 h-5" />
              </a>
              <a href="#" aria-label="LinkedIn">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
            
            <span className="text-muted-foreground text-sm text-center block mb-4">or use your email for registration</span>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
                required
                disabled={isLoading}
              />
              
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
                required
                disabled={isLoading}
              />
              
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as DatabaseUserRole)}
                className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
                required
                disabled={isLoading}
              >
                <option value="">Select Role</option>
                <option value="SUPPORT">Support</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="INVOICING">Invoicing</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            
            <div className="mt-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm mb-4">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Sign Up'}
            </button>
            
            <div className="mobile-switch">
              <p className="text-muted-foreground">Already have an account?</p>
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-primary hover:underline"
              >
                Sign In
              </button>
            </div>
            </div>
          </form>
        </div>
        
        {/* Slide Panel */}
        <div className="slide-panel-wrapper">
          <div className="slide-panel">
            <div className="panel-content panel-content-left">
              <h1 className="text-3xl font-bold mb-4">Welcome Back!</h1>
              <p className="mb-6">Stay connected by logging in with your credentials and continue your experience</p>
              <button 
                className="transparent-btn"
                onClick={() => setIsSignUp(false)}
              >
                Sign In
              </button>
            </div>
            
            <div className="panel-content panel-content-right">
              <h1 className="text-3xl font-bold mb-4">Hey There!</h1>
              <p className="mb-6">Begin your amazing journey by creating an account with us today</p>
              <button 
                className="transparent-btn"
                onClick={() => setIsSignUp(true)}
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
