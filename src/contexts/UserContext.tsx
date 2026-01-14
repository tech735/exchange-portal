import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';

export type UserRole = 'support' | 'warehouse' | 'accounts' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Mock users for testing (fallback only)
const mockUsers: Record<UserRole, User> = {
  admin: {
    id: '0',
    name: 'Admin',
    role: 'admin',
    email: 'admin@example.com',
  },
  support: {
    id: '1',
    name: 'Support User',
    role: 'support',
    email: 'support@example.com',
  },
  warehouse: {
    id: '2',
    name: 'Warehouse Manager',
    role: 'warehouse',
    email: 'warehouse@example.com',
  },
  accounts: {
    id: '3',
    name: 'Accounts Manager',
    role: 'accounts',
    email: 'accounts@example.com',
  },
};

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if we have a real authenticated user
    const checkAuthUser = () => {
      // For now, we'll not set any default user
      // This will force the login page to show
      // In production, this would check Supabase auth state
      const urlParams = new URLSearchParams(window.location.search);
      const useMock = urlParams.get('mock') === 'true';
      
      if (useMock) {
        // Only use mock user if explicitly requested via URL parameter
        setUser(mockUsers.support);
      }
      
      setIsLoading(false);
    };

    checkAuthUser();
  }, []);

  const logout = () => {
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout, isLoading }}>
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
