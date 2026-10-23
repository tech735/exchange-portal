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

/**
 * What a role may open or do. Pages map 1:1 to nav items; the `exchanges.*`
 * entries are actions inside the exchange flow. `admin` (Users & roles,
 * Settings) is never grantable: the database only lets admins write there.
 */
export type Permission =
  | 'dashboard'
  | 'exchanges'
  | 'orders'
  | 'warehouse'
  | 'shipments'
  | 'cases'
  | 'finance'
  | 'exchanges.view'
  | 'exchanges.create'
  | 'exchanges.act_any'
  | 'exchanges.delete'
  | 'admin';

/** Permissions per role, editable under Users & roles. ADMIN always has everything. */
export type RolePermissions = Record<Exclude<UserRole, 'ADMIN'>, Permission[]>;

export const ROLE_ORDER: UserRole[] = ['ADMIN', 'SUPPORT', 'WAREHOUSE', 'INVOICING'];

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Admin',
  SUPPORT: 'Support',
  WAREHOUSE: 'Warehouse',
  INVOICING: 'Finance',
};

export const roleLabel = (role: string | undefined) => (role ? ROLE_LABEL[role as UserRole] ?? role : '');

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  SUPPORT: ['dashboard', 'exchanges', 'exchanges.view', 'exchanges.create', 'orders', 'shipments', 'cases'],
  WAREHOUSE: ['dashboard', 'exchanges.view', 'warehouse', 'shipments', 'cases'],
  INVOICING: ['dashboard', 'exchanges.view', 'finance'],
};

export interface PermissionDef {
  id: Permission;
  label: string;
  hint: string;
  /** 'everyone': always on for every role. 'admin': only admins, not editable. */
  locked?: 'everyone' | 'admin';
  /** Switched on automatically while this other permission is on. */
  impliedBy?: Permission;
  /** Only takes effect while this other permission is on. */
  requires?: Permission;
}

export const PERMISSION_GROUPS: { title: string; items: PermissionDef[] }[] = [
  {
    title: 'Pages',
    items: [
      { id: 'dashboard', label: 'Dashboard', hint: 'Where everyone lands after signing in', locked: 'everyone' },
      { id: 'exchanges', label: 'Exchanges', hint: 'The full exchange queue, views and filters' },
      { id: 'orders', label: 'Orders', hint: 'Look up Shopify orders and start exchanges from them' },
      { id: 'warehouse', label: 'Warehouse', hint: 'Receive returns, run QC and ship replacements' },
      { id: 'shipments', label: 'Shipments', hint: 'Track outgoing orders, delays and the daily report' },
      { id: 'cases', label: 'Cases', hint: 'The special cases board' },
      { id: 'finance', label: 'Finance', hint: 'Payments, invoices and refunds' },
    ],
  },
  {
    title: 'Exchanges',
    items: [
      { id: 'exchanges.view', label: 'Open exchange details', hint: 'From their queue, links and search', impliedBy: 'exchanges' },
      { id: 'exchanges.create', label: 'Lodge new exchanges', hint: 'The "New exchange" button and form' },
      { id: 'exchanges.act_any', label: 'Act on any stage', hint: "Without this, people only act on stages their team owns", requires: 'exchanges.view' },
      { id: 'exchanges.delete', label: 'Delete exchanges', hint: 'Permanently removes an exchange and its history', requires: 'exchanges' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { id: 'admin', label: 'Users & roles, Settings', hint: 'Admins only. The database enforces this', locked: 'admin' },
    ],
  },
];

const PERMISSION_DEFS = PERMISSION_GROUPS.flatMap((g) => g.items);

/** The permissions a stored list actually grants, after locks, implications and requirements. */
export function effectivePermissions(stored: readonly Permission[]): Set<Permission> {
  const on = new Set(stored);
  for (const d of PERMISSION_DEFS) {
    if (d.locked === 'everyone' || (d.impliedBy && on.has(d.impliedBy))) on.add(d.id);
    if (d.locked === 'admin') on.delete(d.id);
  }
  for (const d of PERMISSION_DEFS) if (d.requires && !on.has(d.requires)) on.delete(d.id);
  return on;
}

export function hasPermission(perms: RolePermissions, role: UserRole | undefined, p: Permission, fullAccess = false) {
  if (fullAccess || role === 'ADMIN') return true;
  if (!role) return false;
  return effectivePermissions(perms[role] ?? []).has(p);
}

export interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  permission: Permission;
  section: 'operations' | 'admin';
  /** Short label for the phone tab bar. */
  short?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, permission: 'dashboard', section: 'operations' },
  { to: '/exchanges', label: 'Exchanges', icon: Repeat2, permission: 'exchanges', section: 'operations' },
  { to: '/orders', label: 'Orders', icon: ShoppingBag, permission: 'orders', section: 'operations' },
  { to: '/warehouse', label: 'Warehouse', icon: Warehouse, permission: 'warehouse', section: 'operations' },
  { to: '/shipments', label: 'Shipments', icon: Truck, permission: 'shipments', section: 'operations' },
  { to: '/cases', label: 'Cases', icon: LifeBuoy, permission: 'cases', section: 'operations' },
  { to: '/finance', label: 'Finance', icon: IndianRupee, permission: 'finance', section: 'operations' },
  { to: '/users', label: 'Users & roles', short: 'Users', icon: Users, permission: 'admin', section: 'admin' },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'admin', section: 'admin' },
];

/** The permission a route needs: detail pages need `exchanges.view`, the create flow `exchanges.create`. */
function permissionFor(path: string): Permission | null {
  if (path === '/exchanges/new') return 'exchanges.create';
  if (path.startsWith('/exchanges/')) return 'exchanges.view';
  const top = '/' + (path.split('/')[1] ?? '');
  return NAV_ITEMS.find((i) => i.to === top)?.permission ?? null;
}

export function canAccess(role: UserRole | undefined, path: string, fullAccess = false, perms: RolePermissions = DEFAULT_ROLE_PERMISSIONS) {
  if (fullAccess || role === 'ADMIN') return true;
  const p = permissionFor(path);
  return p ? hasPermission(perms, role, p) : false;
}

export function navFor(role: UserRole | undefined, fullAccess = false, perms: RolePermissions = DEFAULT_ROLE_PERMISSIONS) {
  return NAV_ITEMS.filter((i) => hasPermission(perms, role, i.permission, fullAccess));
}
