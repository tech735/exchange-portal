import { useEffect, useState, createContext, useContext, useRef } from 'react';
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
  signOut: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingProfileRef = useRef<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
          } else {
            setProfile(null);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    // Prevent concurrent fetches for the same user
    if (fetchingProfileRef.current === userId) {
      return;
    }
    
    try {
      fetchingProfileRef.current = userId;
      console.log('Fetching profile for userId:', userId);
      
      // Safety timeout for profile fetch (increased to 15s to handle serverless cold starts)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)
      );

      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) {
        console.error('Profile fetch error:', error);
        return;
      }

      if (data) {
        setProfile(data as Profile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      fetchingProfileRef.current = null;
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Supabase sign out error:', error);
    } finally {
      setProfile(null);
      setUser(null);
      setSession(null);
      setLoading(false);
    }
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
