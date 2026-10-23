import { useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useAppSettings } from '@/hooks/useAppData';
import { canAccess, hasPermission, navFor, DEFAULT_ROLE_PERMISSIONS, type Permission } from '@/lib/navigation';

/**
 * The signed-in person's access, using the role permissions admins set under
 * Users & roles (falls back to the defaults until they load).
 */
export function useAccess() {
  const { user, hasFullAccess } = useUser();
  const { data: settings, isLoading } = useAppSettings();
  const full = hasFullAccess();
  const role = user?.role;
  const perms = settings?.role_permissions ?? DEFAULT_ROLE_PERMISSIONS;

  return useMemo(
    () => ({
      isLoading,
      full: full || role === 'ADMIN',
      can: (p: Permission) => hasPermission(perms, role, p, full),
      canOpen: (path: string) => canAccess(role, path, full, perms),
      nav: navFor(role, full, perms),
    }),
    [isLoading, full, role, perms],
  );
}
