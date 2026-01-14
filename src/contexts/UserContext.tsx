import { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'support' | 'warehouse' | 'accounts' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

interface UserContextType {
  user: User;
  setUser: (user: User) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Mock users for testing
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
  const [user, setUser] = useState<User>(mockUsers.support);

  const logout = () => {
    setUser(mockUsers.support);
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
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
