import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, PageHeader, RowSkeleton, SectionCard, initials } from '@/components/app';
import { AlertTriangle, Eye, EyeOff, KeyRound, MoreHorizontal, Plus, RefreshCw, Trash2, Users as UsersIcon } from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { NAV_ITEMS, ROLE_ACCESS } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/database';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

const ROLE_ORDER: UserRole[] = ['ADMIN', 'SUPPORT', 'WAREHOUSE', 'INVOICING'];

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Admin',
  SUPPORT: 'Support',
  WAREHOUSE: 'Warehouse',
  INVOICING: 'Finance',
};

const ROLE_SUMMARY: Record<UserRole, string> = {
  ADMIN: 'Full access, including people, roles and settings.',
  SUPPORT: 'Handles customer exchanges from request to dispatch.',
  WAREHOUSE: 'Receives returns, runs QC and books shipments.',
  INVOICING: 'Collects payments, invoices and processes refunds.',
};

const roleLabel = (role: string) => ROLE_LABEL[role as UserRole] ?? role;

/** Human-readable list of areas a role can open, derived from ROLE_ACCESS. */
function roleAreas(role: UserRole): string[] {
  const prefixes = ROLE_ACCESS[role] ?? [];
  if (prefixes.includes('/')) return ['Every page', 'Users & roles', 'Settings'];
  return prefixes.map((p) => {
    if (p === '/exchanges/') return 'Exchange details (from their queue)';
    return NAV_ITEMS.find((n) => n.to === p)?.label ?? p;
  });
}

const formatDate = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : (e as { message?: string } | null)?.message || fallback;

// Passwords used to be kept here in plain text. They are no longer recorded; wipe any
// copy left in this browser.
try { localStorage.removeItem('exchange_flow_user_passwords'); } catch { /* storage unavailable */ }

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={6}
        autoComplete="new-password"
        autoFocus={autoFocus}
        className="pr-10 text-base md:text-sm"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function Avatar({ name, self }: { name: string; self?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold',
        self ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
      )}
    >
      {initials(name)}
    </span>
  );
}

function RoleSelect({
  value,
  disabled,
  onChange,
  className,
}: {
  value: UserRole;
  disabled?: boolean;
  onChange: (role: UserRole) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as UserRole)} disabled={disabled}>
      <SelectTrigger className={cn('h-8 w-36', className)} aria-label="Role">
        <SelectValue>{roleLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ROLE_ORDER.map((r) => (
          <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Users() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'SUPPORT' as UserRole,
    password: ''
  });
  const [createError, setCreateError] = useState('');

  const { user: currentUser } = useAuth();
  const { user: contextUser } = useUser();
  // Used by the "you cannot delete/demote yourself" guard.
  const selfId = currentUser?.id ?? contextUser?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch users.
  //
  // The list has to come from the `manage-users` Edge Function (service role), not from a
  // direct `profiles` select: RLS on public.profiles only exposes every row to an admin
  // (policy `profiles_select`). The direct select is kept as a fallback for deployments where the function is not up yet.
  const { data: users = [], isLoading, error: fetchError, refetch, isRefetching } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list-users' }
      });

      if (!error && Array.isArray(data?.users)) {
        return data.users as User[];
      }

      if (error) {
        console.warn('list-users Edge Function unavailable, falling back to direct query:', error);
      } else if (data?.error) {
        console.warn('list-users Edge Function returned an error, falling back:', data.error);
      }

      // Fallback: direct table read (works only for an admin with a real session).
      const { data: rows, error: selectError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectError) {
        console.error('Fetch Users Error:', selectError);
        throw selectError;
      }

      if (!rows || rows.length === 0) {
        throw new Error(
          'Could not load users. The user list is served by the "manage-users" Edge Function — ' +
          'deploy it with `supabase functions deploy manage-users`. ' +
          '(A direct read of profiles returned nothing because row level security hides every ' +
          'row from sessions that are not a signed-in admin.)'
        );
      }

      return rows as User[];
    },
    retry: 1
  });

  if (fetchError) {
    console.error('Fetch Error in component:', fetchError);
  }

  // Create user mutation via Edge Function
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof formData) => {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create-user',
          ...userData
        }
      });

      if (error) throw (error.message ? error : new Error('Failed to invoke function'));
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: `${vars.full_name || vars.email} can now sign in`,
        description: 'Share the password with them now — it is not stored anywhere.',
      });
      setCreateError('');
      setFormData({ email: '', full_name: '', role: 'SUPPORT', password: '' });
      setShowCreateDialog(false);
    },
    onError: (error: unknown) => {
      setCreateError(errorMessage(error, 'Failed to create user'));
    }
  });

  // Reset password mutation via Edge Function
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string; email: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'reset-password',
          userId,
          newPassword: password
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, vars) => {
      toast({
        title: 'Password updated',
        description: `Password for ${vars.email} has been updated.`,
      });
      setResetTarget(null);
      setNewPassword('');
    },
    onError: (error: unknown) => {
      toast({
        title: 'Could not reset password',
        description: errorMessage(error, 'Failed to reset password'),
        variant: 'destructive'
      });
    }
  });

  // Update user mutation (Role only) — routed through the Edge Function for the same
  // reason as the list: a direct update is filtered out by RLS unless the caller is an
  // admin with a real Supabase session.
  const updateUserMutation = useMutation<unknown, Error, { id: string; updates: Partial<User> }>({
    mutationFn: async ({ id, updates }) => {
      if (updates.role) {
        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: { action: 'update-role', userId: id, role: updates.role }
        });

        if (!error && data?.success) return data.user;
        if (data?.error) throw new Error(data.error);
        if (error) console.warn('update-role Edge Function unavailable, falling back:', error);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- profiles update typed loosely, as before
      const { data, error } = await (supabase.from('profiles') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const who = users.find((u) => u.id === vars.id);
      toast({
        title: 'Role updated',
        description: who && vars.updates.role
          ? `${who.full_name || who.email} is now ${roleLabel(vars.updates.role)}.`
          : 'User updated successfully.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Could not change role',
        description: errorMessage(error, 'Failed to update user'),
        variant: 'destructive',
      });
    }
  });

  // Delete user mutation via Edge Function
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete-user',
          userId: id
        }
      });

      if (error) throw (error.message ? error : new Error('Failed to invoke function'));
      return data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const removed = users.find((u) => u.id === id);
      toast({
        title: 'Person removed',
        description: removed ? `${removed.email} can no longer sign in.` : 'User deleted successfully.',
      });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast({
        title: 'Could not remove person',
        description: errorMessage(error, 'Failed to delete user'),
        variant: 'destructive',
      });
    }
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    createUserMutation.mutate(formData);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !newPassword) return;
    resetPasswordMutation.mutate({ userId: resetTarget.id, password: newPassword, email: resetTarget.email });
  };

  const handleUpdateRole = (row: User, role: UserRole) => {
    if (row.id === selfId || role === row.role) return;
    updateUserMutation.mutate({ id: row.id, updates: { role } });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget || deleteTarget.id === selfId) return;
    deleteUserMutation.mutate(deleteTarget.id);
  };

  const openCreate = () => {
    setCreateError('');
    setShowCreateDialog(true);
  };

  const roleCounts = users.reduce<Partial<Record<UserRole, number>>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  const pendingRoleId = updateUserMutation.isPending ? updateUserMutation.variables?.id : undefined;

  const rowActions = (row: User) => {
    const isSelf = row.id === selfId;
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.full_name || row.email}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={() => {
              setNewPassword('');
              setResetTarget(row);
            }}
          >
            <KeyRound />
            Reset password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf}
            onSelect={() => setDeleteTarget(row)}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 />
            {isSelf ? "Can't remove yourself" : 'Remove'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const personCell = (row: User) => {
    const isSelf = row.id === selfId;
    return (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={row.full_name || row.email} self={isSelf} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{row.full_name || 'Unnamed'}</span>
            {isSelf && <Badge variant="brand" className="shrink-0 px-1.5 py-0 text-[11px]">You</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      </div>
    );
  };

  const count = users.length;
  const description = isLoading
    ? 'Manage who can sign in and what each role can do'
    : `${count} ${count === 1 ? 'person' : 'people'} · manage who can sign in and what each role can do`;

  let listBody: React.ReactNode;
  if (isLoading) {
    listBody = <RowSkeleton rows={5} />;
  } else if (fetchError) {
    listBody = (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load people"
        description={<span className="break-words">{errorMessage(fetchError, 'Failed to load users.')}</span>}
        action={
          <Button variant="secondary" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={cn(isRefetching && 'animate-spin')} />
            Try again
          </Button>
        }
      />
    );
  } else if (count === 0) {
    listBody = (
      <EmptyState
        icon={UsersIcon}
        title="No people yet"
        description="Add your teammates so they can sign in to the exchange portal."
        action={<Button onClick={openCreate}><Plus />Add person</Button>}
      />
    );
  } else {
    listBody = (
      <>
        {/* Tablet / desktop table */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Person</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Added</th>
              <th className="w-12 px-2 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((row) => {
              const isSelf = row.id === selfId;
              return (
                <tr key={row.id} className="transition-colors duration-150 hover:bg-muted/40">
                  <td className="max-w-0 px-4 py-3 w-full">{personCell(row)}</td>
                  <td className="px-4 py-3">
                    <RoleSelect
                      value={row.role}
                      disabled={isSelf || pendingRoleId === row.id}
                      onChange={(r) => handleUpdateRole(row, r)}
                    />
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground tabular lg:table-cell">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="px-2 py-3 text-right">{rowActions(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Phone cards */}
        <ul className="divide-y divide-border md:hidden">
          {users.map((row) => {
            const isSelf = row.id === selfId;
            return (
              <li key={row.id} className="space-y-3 px-4 py-3.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">{personCell(row)}</div>
                  {rowActions(row)}
                </div>
                <div className="flex items-center justify-between gap-3 pl-12">
                  <RoleSelect
                    value={row.role}
                    disabled={isSelf || pendingRoleId === row.id}
                    onChange={(r) => handleUpdateRole(row, r)}
                  />
                  <span className="text-xs text-muted-foreground tabular">Added {formatDate(row.created_at)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 animate-fade-in">
        <PageHeader
          title="Users & roles"
          description={description}
          actions={
            <>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => refetch()}
                disabled={isLoading || isRefetching}
                aria-label="Refresh list"
                title="Refresh"
              >
                <RefreshCw className={cn(isRefetching && 'animate-spin')} />
              </Button>
              <Button onClick={openCreate}>
                <Plus />
                Add person
              </Button>
            </>
          }
        />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label="People">
            {listBody}
          </section>

          <SectionCard
            title="What each role can do"
            description="Access is set by role. Change someone's role in the list to change what they see."
          >
            <ul className="space-y-4">
              {ROLE_ORDER.map((r) => (
                <li key={r} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{ROLE_LABEL[r]}</span>
                    {!isLoading && !fetchError && (
                      <span className="text-xs text-muted-foreground tabular">
                        {roleCounts[r] ?? 0} {(roleCounts[r] ?? 0) === 1 ? 'person' : 'people'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{ROLE_SUMMARY[r]}</p>
                  <div className="flex flex-wrap gap-1">
                    {roleAreas(r).map((a) => (
                      <span key={a} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {a}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>

      {/* Add person */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setCreateError('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
            <DialogDescription>They sign in with this email and the password you set here.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            {createError && (
              <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {createError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                placeholder="Priya Sharma"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                required
                autoComplete="off"
                className="text-base md:text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@kotu.co.in"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                autoComplete="off"
                className="text-base md:text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData(prev => ({ ...prev, role: v as UserRole }))}
              >
                <SelectTrigger id="role">
                  <SelectValue>{roleLabel(formData.role)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLE_ORDER.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_SUMMARY[formData.role]}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Initial password</Label>
              <PasswordField
                id="password"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={(v) => setFormData(prev => ({ ...prev, password: v }))}
              />
              <p className="text-xs text-muted-foreground">Share it with them directly — it isn't stored anywhere.</p>
            </div>

            <DialogFooter className="grid grid-cols-2 gap-2 pt-2 sm:flex">
              <Button type="button" variant="secondary" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? 'Adding…' : 'Add person'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setNewPassword('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetTarget?.full_name || resetTarget?.email}
              {resetTarget?.full_name ? ` (${resetTarget.email})` : ''}. Share it with them directly.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <PasswordField
                id="new-password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={setNewPassword}
                autoFocus
              />
            </div>
            <DialogFooter className="grid grid-cols-2 gap-2 pt-2 sm:flex">
              <Button type="button" variant="secondary" onClick={() => setResetTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetPasswordMutation.isPending || !newPassword}>
                {resetPasswordMutation.isPending ? 'Updating…' : 'Update password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleteUserMutation.isPending) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {deleteTarget?.full_name || deleteTarget?.email}?</DialogTitle>
            <DialogDescription>
              This deletes the account for {deleteTarget?.email} and removes their login access. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-2 pt-2 sm:flex">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteUserMutation.isPending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirmDelete} disabled={deleteUserMutation.isPending}>
              {deleteUserMutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
