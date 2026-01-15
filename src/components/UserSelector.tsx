import { useUser, mockUsers, type UserRole } from '@/contexts/UserContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export function UserSelector() {
  const { user, setUser, originalAdminUser, setOriginalAdminUser } = useUser();
  const roles = ['admin'];
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleRoleChange = (role: string) => {
    // Clear all queries when switching users to prevent old data showing
    queryClient.clear();
    
    // If we're switching to admin and there's an original admin user, restore them
    if (role === 'admin' && originalAdminUser) {
      setUser(originalAdminUser);
    } else {
      // If current user is admin and we're switching away, store them as original admin
      if (user?.role === 'admin' && !originalAdminUser) {
        setOriginalAdminUser(user);
      }
      setUser(mockUsers[role]);
    }
    
    // Redirect to dashboard after user switch
    navigate('/dashboard');
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wide">Switch User</p>
      </div>
      <Select value={user.role} onValueChange={handleRoleChange}>
        <SelectTrigger className="w-full bg-sidebar-accent text-sidebar-foreground border-sidebar-border">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
