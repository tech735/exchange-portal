import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, X, MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';
import { useTickets } from '@/hooks/useTickets';
import { useSpecialCases } from '@/hooks/useShipments';
import { cn } from '@/lib/utils';
import { navFor, canAccess, type NavItem } from '@/lib/navigation';
import { getExchangeStatus } from '@/lib/exchangeStatus';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { CommandPalette, useCommandPaletteHotkey } from '@/components/CommandPalette';
import { initials } from '@/components/app';

const COLLAPSED_KEY = 'sidebar-collapsed';

/** Live counts shown next to nav items: work waiting in each area. */
function useNavCounts() {
  const { data: tickets = [] } = useTickets();
  const { data: cases = [] } = useSpecialCases();
  return useMemo(() => {
    const c = { exchanges: 0, warehouse: 0, finance: 0, cases: 0 };
    for (const t of tickets) {
      const k = getExchangeStatus(t).key;
      if (k === 'REQUESTED' || k === 'AWAITING_PAYMENT') c.exchanges++;
      if (k === 'TO_BOOK_PICKUP' || k === 'QC_PENDING' || k === 'READY_TO_SHIP') c.warehouse++;
      if (k === 'SHIPPED' || k === 'INVOICING' || k === 'REFUND_DUE') c.finance++;
    }
    c.cases = cases.filter((x) => x.status === 'OPEN').length;
    return { '/exchanges': c.exchanges, '/warehouse': c.warehouse, '/finance': c.finance, '/cases': c.cases } as Record<string, number>;
  }, [tickets, cases]);
}

function isActive(pathname: string, to: string) {
  return pathname === to || (to !== '/dashboard' && pathname.startsWith(to + '/')) || (to === '/exchanges' && pathname.startsWith('/exchanges'));
}

function NavLink({ item, active, collapsed, count, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; count?: number; onNavigate?: () => void }) {
  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-9 items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150',
        collapsed ? 'justify-center w-10 mx-auto' : 'px-2.5',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <item.icon className={cn('size-[18px] shrink-0', active ? 'text-primary' : 'text-faint group-hover:text-foreground')} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && !!count && (
        <span className={cn('rounded-full px-1.5 text-[11px] leading-5 tabular', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{count}</span>
      )}
      {collapsed && !!count && <span className="absolute right-1 top-1 size-2 rounded-full bg-primary ring-2 ring-sidebar" aria-hidden />}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}{count ? ` · ${count}` : ''}</TooltipContent>
    </Tooltip>
  );
}

function SidebarContent({ collapsed, onNavigate, onToggleCollapsed, showClose, onClose }: { collapsed: boolean; onNavigate?: () => void; onToggleCollapsed?: () => void; showClose?: boolean; onClose?: () => void }) {
  const { pathname } = useLocation();
  const { user, hasFullAccess } = useUser();
  const counts = useNavCounts();
  const items = navFor(user?.role, hasFullAccess());
  const ops = items.filter((i) => i.section === 'operations');
  const admin = items.filter((i) => i.section === 'admin');

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 shrink-0 items-center gap-2.5', collapsed ? 'justify-center px-2' : 'px-4')}>
        <Link to="/dashboard" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5">
          <img src="/Vector-Blue-KOTU-Logo.png" alt="KOTU" className="size-8 shrink-0 rounded-full" />
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block font-heading text-[15px] font-semibold text-foreground">KOTU</span>
              <span className="block text-xs text-muted-foreground">Exchange portal</span>
            </span>
          )}
        </Link>
        {showClose && (
          <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onClose} aria-label="Close menu">
            <X />
          </Button>
        )}
      </div>

      <nav className={cn('flex-1 overflow-y-auto scrollbar-thin pb-4', collapsed ? 'px-2' : 'px-3')} aria-label="Main">
        {!collapsed && <p className="px-2.5 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Operations</p>}
        <div className="space-y-0.5">
          {ops.map((i) => <NavLink key={i.to} item={i} active={isActive(pathname, i.to)} collapsed={collapsed} count={counts[i.to]} onNavigate={onNavigate} />)}
        </div>
        {admin.length > 0 && (
          <>
            {collapsed ? <div className="my-3 h-px bg-border" /> : <p className="px-2.5 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-faint">Admin</p>}
            <div className="space-y-0.5">
              {admin.map((i) => <NavLink key={i.to} item={i} active={isActive(pathname, i.to)} collapsed={collapsed} onNavigate={onNavigate} />)}
            </div>
          </>
        )}
      </nav>

      {onToggleCollapsed && (
        <div className={cn('border-t border-border p-2', collapsed ? 'flex justify-center' : '')}>
          <Button variant="ghost" size="sm" onClick={onToggleCollapsed} className={cn('text-muted-foreground', collapsed ? 'w-10 px-0' : 'w-full justify-start')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen /> : <><PanelLeftClose /> Collapse</>}
          </Button>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = async () => {
    try { await signOut(); } finally { logout(); navigate('/login'); }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="grid size-9 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground ring-offset-background transition-shadow hover:ring-2 hover:ring-primary/20 focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
          {initials(user?.name)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-primary">{user?.role === 'INVOICING' ? 'Finance' : user?.role?.toLowerCase()}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { user, hasFullAccess } = useUser();
  const canCreate = canAccess(user?.role, '/exchanges/new', hasFullAccess());
  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 shrink-0 items-center gap-2 border-b border-border bg-card/90 px-3 sm:px-6 lg:px-8 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Open menu"><Menu /></Button>
      <img src="/Vector-Blue-KOTU-Logo.png" alt="" className="size-7 rounded-full md:hidden" />
      <button
        onClick={onSearch}
        className="hidden md:flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-faint transition-colors hover:border-input hover:text-muted-foreground"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left truncate">Search orders, exchanges, AWB, phone…</span>
        <kbd className="kbd">⌘K</kbd>
      </button>
      <div className="flex-1" />
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onSearch} aria-label="Search"><Search /></Button>
      {canCreate && (
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link to="/exchanges/new"><Plus /> New exchange</Link>
        </Button>
      )}
      <NotificationsPanel />
      <UserMenu />
    </header>
  );
}

function MobileTabBar({ onMore }: { onMore: () => void }) {
  const { pathname } = useLocation();
  const { user, hasFullAccess } = useUser();
  const items = navFor(user?.role, hasFullAccess()).filter((i) => i.section === 'operations').slice(0, 4);
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Quick">
      {items.map((i) => {
        const active = isActive(pathname, i.to);
        return (
          <Link key={i.to} to={i.to} className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors', active ? 'text-primary' : 'text-muted-foreground')}>
            <i.icon className="size-5" />
            {i.short ?? i.label}
          </Link>
        );
      })}
      <button onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground">
        <MoreHorizontal className="size-5" /> More
      </button>
    </nav>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');
  useCommandPaletteHotkey(() => setPalette(true));

  useEffect(() => { localStorage.setItem(COLLAPSED_KEY, String(collapsed)); }, [collapsed]);
  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawer]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Tablet: icon rail. Desktop: full sidebar (collapsible). */}
      <aside
        className={cn(
          'hidden md:flex sticky top-0 h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out-soft',
          'md:w-[72px]', collapsed ? 'lg:w-[72px]' : 'lg:w-60',
        )}
      >
        <div className="hidden lg:flex h-full flex-col w-full">
          <SidebarContent collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
        </div>
        <div className="flex lg:hidden h-full flex-col w-full">
          <SidebarContent collapsed />
        </div>
      </aside>

      {/* Phone / tablet drawer */}
      <div className={cn('fixed inset-0 z-50 md:hidden', drawer ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!drawer}>
        <div className={cn('absolute inset-0 bg-foreground/40 transition-opacity duration-200', drawer ? 'opacity-100' : 'opacity-0')} onClick={() => setDrawer(false)} />
        <div className={cn('absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar shadow-overlay transition-transform duration-200 ease-out-soft', drawer ? 'translate-x-0' : '-translate-x-full')}>
          <SidebarContent collapsed={false} showClose onClose={() => setDrawer(false)} onNavigate={() => setDrawer(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
        <main className="flex-1 pb-safe-tabbar md:pb-10">
          <div key={pathname} className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7 animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      <MobileTabBar onMore={() => setDrawer(true)} />
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  );
}
