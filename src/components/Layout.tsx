import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';
import { LayoutDashboard, Package, Warehouse, Receipt, LogOut, User, Mail, ShoppingCart, ChevronsUpDown } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsPanel } from './NotificationsPanel';

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
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2">
          <Link to="/dashboard" className="flex items-center gap-2.5 px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
            <img src="/Vector-Blue-KOTU-Logo.png" alt="KOTU Logo" className="w-8 h-8 object-contain shrink-0" />
            <span className="text-lg font-semibold leading-none text-sidebar-foreground group-data-[collapsible=icon]:hidden">Exchange Portal</span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={location.pathname === to} tooltip={label}>
                      <Link to={to}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                  <User className="h-4 w-4 text-sidebar-primary" />
                </div>
                <div className="flex-1 min-w-0 text-left group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-sidebar-foreground/50 capitalize truncate">
                    {user?.role || 'guest'}
                    {hasFullAccess() && user?.role !== 'ADMIN' && ' · Full Access'}
                  </p>
                </div>
                <ChevronsUpDown className="ml-auto h-4 w-4 text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="app-header">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <GlobalSearch />
          <div className="flex items-center gap-3 ml-auto">
            <button className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition">
              <Mail className="h-4 w-4" />
            </button>
            <NotificationsPanel />
            <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border">
              <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                <User className="h-4 w-4 text-sidebar-primary" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-foreground leading-tight">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground capitalize leading-tight">{user?.role || 'guest'}</p>
              </div>
            </div>
          </div>
        </header>
        <div className="app-content">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
