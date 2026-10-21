import {
  LayoutDashboard,
  Repeat2,
  ShoppingBag,
  Warehouse,
  Truck,
  LifeBuoy,
  IndianRupee,
  Users,
  Settings,
} from 'lucide-react';
import type { UserRole } from '@/types/database';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  section: 'operations' | 'admin';
  /** Short label for the phone tab bar. */
  short?: string;
}

const ALL: UserRole[] = ['ADMIN', 'SUPPORT', 'WAREHOUSE', 'INVOICING'];

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, roles: ALL, section: 'operations' },
  { to: '/exchanges', label: 'Exchanges', icon: Repeat2, roles: ['ADMIN', 'SUPPORT'], section: 'operations' },
  { to: '/orders', label: 'Orders', icon: ShoppingBag, roles: ['ADMIN', 'SUPPORT'], section: 'operations' },
  { to: '/warehouse', label: 'Warehouse', icon: Warehouse, roles: ['ADMIN', 'WAREHOUSE'], section: 'operations' },
  { to: '/shipments', label: 'Shipments', icon: Truck, roles: ['ADMIN', 'SUPPORT', 'WAREHOUSE'], section: 'operations' },
  { to: '/cases', label: 'Cases', icon: LifeBuoy, roles: ['ADMIN', 'SUPPORT', 'WAREHOUSE'], section: 'operations' },
  { to: '/finance', label: 'Finance', icon: IndianRupee, roles: ['ADMIN', 'INVOICING'], section: 'operations' },
  { to: '/users', label: 'Users & roles', short: 'Users', icon: Users, roles: ['ADMIN'], section: 'admin' },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'], section: 'admin' },
];

/**
 * Route prefixes each role may open. A trailing slash grants detail pages only:
 * WAREHOUSE and INVOICING can open /exchanges/:id from their queues, but not
 * the exchanges list or the create flow.
 */
export const ROLE_ACCESS: Record<UserRole, string[]> = {
  ADMIN: ['/'],
  SUPPORT: ['/dashboard', '/exchanges', '/orders', '/shipments', '/cases'],
  WAREHOUSE: ['/dashboard', '/exchanges/', '/warehouse', '/shipments', '/cases'],
  INVOICING: ['/dashboard', '/exchanges/', '/finance'],
};

export function canAccess(role: UserRole | undefined, path: string, fullAccess = false) {
  if (fullAccess || role === 'ADMIN') return true;
  const allowed = ROLE_ACCESS[role ?? 'SUPPORT'] ?? [];
  return allowed.some((p) =>
    p.endsWith('/')
      ? path.startsWith(p) && path.length > p.length && !path.startsWith(p + 'new')
      : path === p || path.startsWith(p + '/'),
  );
}

export function navFor(role: UserRole | undefined, fullAccess = false) {
  return NAV_ITEMS.filter((i) => fullAccess || (role ? i.roles.includes(role) : false));
}
