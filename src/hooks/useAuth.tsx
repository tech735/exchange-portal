import { useEffect, useState, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import type { Profile, UserRole } from '@/types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const initAuth = async () => {
      try {
        // Add 2 second timeout for auth initialization
        timeoutId = setTimeout(() => {
          if (isMounted && loading) {
            setLoading(false);
          }
        }, 2000);

        // Skip Supabase auth check for now to avoid bearer token issues
        // const { data: { session } } = await supabase.auth.getSession();
        
        if (isMounted) {
          // setSession(session);
          // setUser(session?.user ?? null);
          // if (session?.user) {
          //   await fetchProfile(session.user.id);
          //   // Redirect to dashboard after successful authentication
          //   navigate('/dashboard');
          // } else {
            setLoading(false);
          // }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isMounted) {
          setLoading(false);
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    initAuth();

    // Skip Supabase auth listener for now
    // const { data: { subscription } } = supabase.auth.onAuthStateChange(
    //   async (_event, session) => {
    //     if (isMounted) {
    //       setSession(session);
    //       setUser(session?.user ?? null);
    //       if (session?.user) {
    //         await fetchProfile(session.user.id);
    //         // Redirect to dashboard after successful authentication
    //         navigate('/dashboard');
    //       } else {
    //         setProfile(null);
    //         setLoading(false);
    //       }
    //     }
    //   }
    // );

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // subscription?.unsubscribe();
    };
  }, [navigate, loading]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data as Profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Redirect will be handled by onAuthStateChange listener
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
    // Redirect will be handled by onAuthStateChange listener
  };

  const signOut = async () => {
    // Skip Supabase auth signOut for mock authentication
    // const { error } = await supabase.auth.signOut();
    // if (error) throw error;
    console.log('Mock sign out successful');
  };

  const hasRole = (roles: UserRole[]) => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      session, 
      loading, 
      signIn, 
      signUp, 
      signOut,
      hasRole 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
