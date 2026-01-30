import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserRole } from '@/types/database';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

interface UserContextType {
  user: User | null;
  originalAdminUser: User | null;
  setUser: (user: User | null) => void;
  setOriginalAdminUser: (user: User | null) => void;
  logout: () => void;
  isLoading: boolean;
  hasFullAccess: () => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Mock users for testing (fallback only)
const mockUsers: Record<string, User> = {
  admin: {
    id: '0',
    name: 'Admin',
    role: 'ADMIN',
    email: 'admin@kotu.com',
  },
};

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [originalAdminUser, setOriginalAdminUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if we have a persisted user in localStorage
    const checkPersistedUser = () => {
      try {
        const persistedUser = localStorage.getItem('user');
        const persistedOriginalAdmin = localStorage.getItem('originalAdminUser');
        
        if (persistedUser) {
          const parsedUser = JSON.parse(persistedUser);
          setUser(parsedUser);
        }
        
        if (persistedOriginalAdmin) {
          const parsedOriginalAdmin = JSON.parse(persistedOriginalAdmin);
          setOriginalAdminUser(parsedOriginalAdmin);
        }
      } catch (error) {
        console.error('Error parsing persisted user:', error);
        // Clear corrupted data
        localStorage.removeItem('user');
        localStorage.removeItem('originalAdminUser');
      }
      
      setIsLoading(false);
    };

    checkPersistedUser();
  }, []);

  // Persist user state to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  // Persist original admin user state
  useEffect(() => {
    if (originalAdminUser) {
      localStorage.setItem('originalAdminUser', JSON.stringify(originalAdminUser));
    } else {
      localStorage.removeItem('originalAdminUser');
    }
  }, [originalAdminUser]);

  const logout = () => {
    setUser(null);
    setOriginalAdminUser(null);
  };

  const hasFullAccess = () => {
    return originalAdminUser?.role === 'ADMIN' || user?.role === 'ADMIN';
  };

  return (
    <UserContext.Provider value={{ user, originalAdminUser, setUser, setOriginalAdminUser, logout, isLoading, hasFullAccess }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export { mockUsers };
