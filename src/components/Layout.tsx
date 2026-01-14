import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Package, Warehouse, Receipt, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserSelector } from '@/components/UserSelector';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const allNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'support', 'warehouse', 'accounts'] },
  { to: '/exchange-lodging', label: 'Exchange Lodging', icon: Package, roles: ['admin', 'support'] },
  { to: '/warehouse', label: 'Warehouse', icon: Warehouse, roles: ['admin', 'warehouse'] },
  { to: '/invoicing', label: 'Invoicing', icon: Receipt, roles: ['admin', 'accounts'] },
  { to: '/users', label: 'Users', icon: User, roles: ['admin'] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { logout } = useUser();

  // Filter navigation items based on user role
  const navItems = allNavItems.filter(item => user?.role ? item.roles.includes(user.role) : false);

  const handleSignOut = async () => {
    await signOut();
    logout(); // Clear user state
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img src="/src/assets/Vector-Blue-KOTU-Logo.png" alt="KOTU Logo" className="w-10 h-10" />
            <div>
              <h1 className="font-semibold text-sidebar-foreground">Exchange Portal</h1>
              <p className="text-xs text-sidebar-foreground/60">Manage Returns</p>
            </div>
          </div>
        </div>
        
        {user?.role === 'admin' && (
          <div className="p-4 border-b border-sidebar-border">
            <UserSelector />
          </div>
        )}

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={cn('sidebar-nav-item', location.pathname === to && 'sidebar-nav-item-active')}>
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
              <User className="h-4 w-4 text-sidebar-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role || 'guest'}</p>
            </div>
          </div>
          <div className={cn('sidebar-nav-item', 'w-full justify-start cursor-pointer')} onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
