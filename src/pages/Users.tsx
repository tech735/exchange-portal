import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DataTable, type DataTableProps } from '@/components/ui/DataTable';
import { Shield, Trash2, Users as UsersIcon, Plus, Edit, User, Key, Eye, EyeOff } from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types/database';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

const roles = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'INVOICING', label: 'Accounts' }
];

export default function Users() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'SUPPORT' as UserRole,
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch users
  const { data: users = [], isLoading, error: fetchError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      console.log('Fetching users from profiles...');
      
      // Create a timeout promise to prevent infinite hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database request timed out after 10 seconds. This usually means there is a security loop in the database.')), 10000)
      );

      const fetchPromise = (async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Fetch Users Error:', error);
          throw error;
        }
        return data;
      })();

      const data = await Promise.race([fetchPromise, timeoutPromise]) as User[];
      console.log('Fetched users:', data);
      return data;
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccess('User created successfully! They can now log in with their email and password.');
      setError('');
      setFormData({ email: '', full_name: '', role: 'SUPPORT', password: '' });
      setShowCreateDialog(false);
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to create user');
      setSuccess('');
    }
  });

  // Reset password mutation via Edge Function
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
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
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Password for ${resetTarget?.email} has been updated.`,
      });
      setShowResetDialog(false);
      setNewPassword('');
      setResetTarget(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive"
      });
    }
  });

  // Update user mutation (Role only)
  const updateUserMutation = useMutation<any, Error, { id: string; updates: Partial<User> }>({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await (supabase.from('profiles') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccess('User updated successfully!');
      setError('');
    },
    onError: (error: unknown) => {
      setError(error instanceof Error ? error.message : 'Failed to update user');
      setSuccess('');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccess('User deleted successfully!');
      setError('');
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to delete user');
      setSuccess('');
    }
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    createUserMutation.mutate(formData);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !newPassword) return;
    resetPasswordMutation.mutate({ userId: resetTarget.id, password: newPassword });
  };

  const handleUpdateUser = (id: string, updates: Partial<User>) => {
    setError('');
    setSuccess('');
    updateUserMutation.mutate({ id, updates });
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Are you sure you want to delete this user? This will remove their login access as well.')) {
      setError('');
      setSuccess('');
      deleteUserMutation.mutate(id);
    }
  };


  const columns = [
    {
      key: 'email',
      label: 'Email',
      render: (value: string) => (
        <span className="font-medium text-foreground">{value}</span>
      )
    },
    {
      key: 'full_name',
      label: 'Full Name',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>{value}</span>
        </div>
      )
    },
    {
      key: 'role',
      label: 'Role',
      render: (value: string, row: User) => (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <Select
            value={value}
            onValueChange={(newRole) => handleUpdateUser(row.id, { role: newRole as UserRole })}
            disabled={row.id === currentUser?.id}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (value: string) => (
        <span className="text-sm text-muted-foreground">
          {new Date(value).toLocaleDateString()}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: unknown, row: User) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              setResetTarget(row);
              setShowResetDialog(true);
            }}
          >
            <Key className="h-3 w-3 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 w-8 p-0"
            onClick={() => handleDeleteUser(row.id)}
            disabled={row.id === currentUser?.id}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <Layout>
      <div className="page-shell animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold text-foreground mt-2 text-gradient">User Management</h1>
            <p className="text-muted-foreground mt-2">Manage system users, passwords, and access roles</p>
          </div>

          <div className="flex gap-2">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="glass-morphism-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  {success && (
                    <Alert className="bg-green-50 text-green-700 border-green-200">
                      <AlertDescription>{success}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      placeholder="John Doe"
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Initial Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 6 characters"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        required
                        minLength={6}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">System Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as UserRole }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2 pt-6">
                    <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createUserMutation.isPending} className="bg-primary">
                      {createUserMutation.isPending ? 'Processing...' : 'Create User'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Reset Password Dialog */}
        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Password for {resetTarget?.full_name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4 pt-4">
              {resetTarget?.id === 'admin-fallback-id' ? (
                <div className="bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 rounded-xl text-sm font-medium">
                  This user is a temporary "System Fallback" account. You cannot reset its password. 
                  Please <strong>Create User</strong> to add a real administrative account instead.
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showResetPassword ? "text" : "password"}
                      placeholder="Enter new password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-6">
                <Button type="button" variant="outline" onClick={() => setShowResetDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={resetPasswordMutation.isPending || resetTarget?.id === 'admin-fallback-id'}
                  className="bg-primary hover:bg-primary/90"
                >
                  {resetPasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Card className="card-base mt-12 overflow-hidden border-none shadow-premium bg-white/50 backdrop-blur-sm">
          <CardHeader className="border-b bg-muted/30 px-6 py-4">
            <CardTitle className="text-lg font-medium">Active System Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              data={users}
              columns={columns}
              isLoading={isLoading}
              emptyMessage="No users found"
            />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
