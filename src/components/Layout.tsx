import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Package, Warehouse, Receipt, LogOut, User, Menu, X, Bell, Mail, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const allNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPPORT', 'WAREHOUSE', 'INVOICING'] },
  { to: '/exchange-lodging', label: 'Exchange Lodging', icon: Package, roles: ['ADMIN', 'SUPPORT'] },
  { to: '/warehouse', label: 'Warehouse', icon: Warehouse, roles: ['ADMIN', 'WAREHOUSE'] },
  { to: '/invoicing', label: 'Invoicing', icon: Receipt, roles: ['ADMIN', 'INVOICING'] },
  { to: '/users', label: 'Users', icon: User, roles: ['ADMIN'] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { user, logout, hasFullAccess } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filter navigation items based on user role or full access
  const navItems = allNavItems.filter(item => {
    if (hasFullAccess()) {
      return true; // Admin users with full access can see all items
    }
    return user?.role ? item.roles.includes(user.role) : false;
  });

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
    <div className="app-shell">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-4 left-4 z-50 w-64 flex flex-col transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="app-sidebar h-full flex flex-col">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/Vector-Blue-KOTU-Logo.png" alt="KOTU Logo" className="w-10 h-10" />
              <div>
                <h1 className="font-semibold text-sidebar-foreground">Exchange Portal</h1>
                <p className="text-xs text-sidebar-foreground/60">Manage Returns</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            <p className="px-3 pt-2 text-[11px] uppercase tracking-[0.2em] text-sidebar-foreground/50">Menu</p>
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className={cn('sidebar-nav-item', location.pathname === to && 'sidebar-nav-item-active')}>
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="p-4">
            <p className="px-3 text-[11px] uppercase tracking-[0.2em] text-sidebar-primary/70">General</p>
            <div className="flex items-center gap-3 px-4 py-3 mt-2 rounded-2xl">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
                <User className="h-4 w-4 text-sidebar-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">
                  {user?.role || 'guest'}
                  {hasFullAccess() && user?.role !== 'ADMIN' && (
                    <span className="ml-1 text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">Full Access</span>
                  )}
                </p>
              </div>
            </div>
            <div className={cn('sidebar-nav-item', 'w-full justify-start cursor-pointer mt-2')} onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <img src="/Vector-Blue-KOTU-Logo.png" alt="KOTU Logo" className="w-8 h-8" />
            <span className="font-semibold text-sm">Exchange Portal</span>
          </div>
          <div className="w-8" /> {/* Spacer for centering */}
        </div>
      </div>

      <main className="flex-1 overflow-auto lg:pt-0 pt-16">
        <div className="hidden lg:block app-header">
          <div className="flex items-center gap-4 w-full">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="h-11 w-full rounded-full bg-white px-10 text-sm text-foreground placeholder:text-muted-foreground shadow-sm border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Search tickets, orders, people"
              />
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <button className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition">
                <Mail className="h-4 w-4" />
              </button>
              <button className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition">
                <Bell className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 pl-3 border-l border-border">
                <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <User className="h-4 w-4 text-sidebar-foreground" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role || 'guest'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
