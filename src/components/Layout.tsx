import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Package, Warehouse, Receipt, LogOut, User, Menu, X, Bell, Mail, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from './GlobalSearch';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const allNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPPORT', 'WAREHOUSE', 'INVOICING'] },
  { to: '/orders', label: 'Orders', icon: ShoppingCart, roles: ['ADMIN', 'SUPPORT'] },
  { to: '/exchange-lodging', label: 'Exchange Tickets', icon: Package, roles: ['ADMIN', 'SUPPORT'] },
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
    try {
      await signOut();
    } finally {
      logout(); // Clear user state even if signOut fails
      navigate('/login');
    }
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

      {/* Sidebar — fixed to the viewport at every breakpoint, so its height
          never depends on the content of the page beside it. */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 h-screen flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="app-sidebar h-full flex flex-col">
          <div className="px-6 py-6 flex items-center justify-between border-b border-sidebar-border">
            <div className="flex items-center gap-2.5">
              <img src="/Vector-Blue-KOTU-Logo.png" alt="KOTU Logo" className="w-8 h-8 object-contain" />
              <span className="text-lg font-semibold leading-none text-sidebar-foreground">Exchange Portal</span>
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

          <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto scrollbar-thin">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Menu</p>
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className={cn('sidebar-nav-item', location.pathname === to && 'sidebar-nav-item-active')}>
                <Icon className="h-[18px] w-[18px]" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                <User className="h-4 w-4 text-sidebar-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-sidebar-foreground/50 capitalize">
                  {user?.role || 'guest'}
                  {hasFullAccess() && user?.role !== 'ADMIN' && (
                    <span className="ml-1 text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">Full Access</span>
                  )}
                </p>
              </div>
            </div>
            <div className={cn('sidebar-nav-item', 'w-full justify-start cursor-pointer mt-1')} onClick={handleSignOut}>
              <LogOut className="h-[18px] w-[18px]" />
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

      <main className="flex-1 min-w-0 overflow-x-hidden lg:ml-64 lg:pt-0 pt-16">
        <div className="hidden lg:flex app-header">
          <div className="flex items-center gap-4 w-full">
            <GlobalSearch />
            <div className="flex items-center gap-3 ml-auto">
              <button className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition">
                <Mail className="h-4 w-4" />
              </button>
              <button className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-primary border border-background rounded-full" />
              </button>
              <div className="flex items-center gap-3 pl-3 border-l border-border">
                <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <User className="h-4 w-4 text-sidebar-primary" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground leading-tight">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground capitalize leading-tight">{user?.role || 'guest'}</p>
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
