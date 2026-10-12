import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  LogOut,
  User,
  ShoppingCart,
  X,
  Search,
  Bell,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

const navigationGeneral: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPPORT', 'WAREHOUSE', 'INVOICING'] },
  { to: '/orders', label: 'Orders', icon: ShoppingCart, roles: ['ADMIN', 'SUPPORT'] },
  { to: '/shipments', label: 'Shipments', icon: Truck, roles: ['ADMIN', 'SUPPORT', 'WAREHOUSE'] },
  { to: '/exchange-lodging', label: 'Exchange Tickets', icon: Package, roles: ['ADMIN', 'SUPPORT'] },
  { to: '/warehouse', label: 'Warehouse', icon: Warehouse, roles: ['ADMIN', 'WAREHOUSE'] },
  // Invoicing page is disabled for now — re-enable alongside the route in App.tsx.
  // { to: '/invoicing', label: 'Invoicing', icon: Receipt, roles: ['ADMIN', 'INVOICING'] },
];

const navigationAdmin: NavItem[] = [
  { to: '/users', label: 'Users', icon: User, roles: ['ADMIN'] },
];

function SidebarLink({
  item,
  isActive,
  collapsed,
  onClose,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClose: () => void;
}) {
  const link = (
    <Link
      to={item.to}
      onClick={onClose}
      className={cn(
        collapsed ? 'sidebar-nav-item-collapsed' : 'sidebar-nav-item',
        isActive && 'sidebar-nav-item-active'
      )}
      aria-label={collapsed ? item.label : undefined}
    >
      <item.icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-sidebar-primary')} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function AppSidebar({
  isOpen,
  onClose,
  collapsed,
  onToggleCollapsed,
}: {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { user, logout, hasFullAccess } = useUser();

  const filterNav = (items: NavItem[]) =>
    items.filter(item => hasFullAccess() || (user?.role ? item.roles.includes(user.role) : false));

  const generalItems = filterNav(navigationGeneral);
  const adminItems = filterNav(navigationAdmin);

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      logout();
      navigate('/login');
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  const isItemActive = (to: string) =>
    location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to));

  return (
    <aside
      className={cn(
        'app-sidebar flex flex-col transition-all duration-300 ease-in-out h-screen',
        'lg:translate-x-0 lg:sticky lg:top-0',
        collapsed ? 'lg:w-[72px]' : 'lg:w-60',
        'fixed inset-y-0 left-0 z-50 w-72',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Brand */}
      <div className={cn('flex items-center h-16 px-4', collapsed ? 'lg:justify-center lg:px-2' : 'justify-between')}>
        <Link to="/dashboard" className="flex items-center gap-3 min-w-0">
          <img
            src="/Vector-Blue-KOTU-Logo.png"
            alt="KOTU Logo"
            className="w-9 h-9 object-contain shrink-0"
          />
          <span className={cn('text-base font-medium text-sidebar-foreground truncate', collapsed && 'lg:hidden')}>
            Exchange Portal
          </span>
        </Link>

        {/* Close - mobile only */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="lg:hidden h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Collapse toggle - desktop only */}
      <div className={cn('hidden lg:flex px-3 pb-2', collapsed ? 'justify-center' : 'justify-end')}>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapsed}
              className="h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
        </Tooltip>
      </div>

      {/* Navigation */}
      <div className={cn('flex-1 py-2 overflow-y-auto overflow-x-hidden scrollbar-thin', collapsed ? 'px-2' : 'px-3')}>
        <div className="space-y-2">
          <div className={cn('px-2 text-[11px] font-medium tracking-wide text-sidebar-muted', collapsed && 'lg:hidden')}>
            GENERAL
          </div>

          <nav className="space-y-1">
            {generalItems.map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                isActive={isItemActive(item.to)}
                collapsed={collapsed}
                onClose={onClose}
              />
            ))}
          </nav>

          {adminItems.length > 0 && (
            <>
              <div className={cn('pt-3 px-2 text-[11px] font-medium tracking-wide text-sidebar-muted', collapsed && 'lg:hidden')}>
                ADMIN
              </div>

              <nav className="space-y-1">
                {adminItems.map((item) => (
                  <SidebarLink
                    key={item.to}
                    item={item}
                    isActive={isItemActive(item.to)}
                    collapsed={collapsed}
                    onClose={onClose}
                  />
                ))}
              </nav>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={cn('border-t border-sidebar-border py-3 space-y-2', collapsed ? 'px-2' : 'px-3')}>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={handleSignOut}
              className={cn(collapsed ? 'sidebar-nav-item-collapsed' : 'sidebar-nav-item w-full text-left')}
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Sign Out</TooltipContent>}
        </Tooltip>

        <div className="pt-2">
          <div
            className={cn(
              'flex items-center rounded-lg border border-sidebar-border bg-card shadow-sm',
              collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-3'
            )}
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-muted text-primary text-sm font-medium">
                {user?.name ? getInitials(user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-sidebar-muted truncate capitalize">
                  {user?.role?.toLowerCase() || 'guest'}
                  {hasFullAccess() && user?.role !== 'ADMIN' && ' · Full Access'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { user } = useUser();

  const getInitials = (name: string) =>
    name.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 sm:px-6 bg-background gap-3">
      {/* Hamburger - mobile only */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuOpen}
        className="lg:hidden h-9 w-9 shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Search - hidden on mobile, visible on desktop */}
      <div className="relative hidden sm:block w-72 lg:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search tickets, orders..."
          className="pl-10 bg-card border-border"
        />
      </div>

      {/* Mobile: logo/title centered */}
      <div className="flex-1 flex justify-center sm:hidden">
        <span className="text-sm font-semibold text-foreground">Exchange Portal</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="w-5 h-5 text-muted-foreground" />
        </Button>

        {/* User Avatar */}
        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border/70">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
            {user?.name ? getInitials(user.name) : 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  );
  const { user } = useUser();
  const location = useLocation();

  // The top bar is a dashboard-only surface; every other page relies on the
  // sidebar (and the mobile menu button below) for navigation.
  const showTopBar = location.pathname === '/dashboard';

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AppSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {showTopBar ? (
          <TopBar onMenuOpen={() => setSidebarOpen(true)} />
        ) : (
          // Without the top bar, mobile still needs a way to reach the sidebar.
          <div className="lg:hidden sticky top-0 z-10 flex items-center h-14 px-4 bg-background">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="h-9 w-9 shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        )}
        <main className="flex-1 px-4 py-5 sm:px-8 sm:py-7 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
