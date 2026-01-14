import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { UserProvider, useUser, type UserRole } from "@/contexts/UserContext";
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import ExchangeLodging from '@/pages/ExchangeLodging';
import Warehouse from '@/pages/Warehouse';
import Invoicing from '@/pages/Invoicing';
import TicketDetail from '@/pages/TicketDetail';
import Login from '@/pages/Login';
import Users from '@/pages/Users';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient();

// Define role-based access to pages
const roleAccess: Record<UserRole, string[]> = {
  admin: ['/', '/dashboard', '/exchange-lodging', '/warehouse', '/invoicing', '/users', '/ticket'],
  support: ['/', '/dashboard', '/exchange-lodging', '/ticket'],
  warehouse: ['/', '/dashboard', '/warehouse'],
  accounts: ['/', '/dashboard', '/invoicing'],
};

function ProtectedRoute({ 
  children, 
  requiredPaths 
}: { 
  children: React.ReactNode
  requiredPaths: string[]
}) {
  const { user, isLoading } = useUser();
  
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userPaths = roleAccess[user.role];
  
  // Check if user has access to any of the required paths
  const hasAccess = requiredPaths.some(path => 
    userPaths.some(userPath => path.startsWith(userPath))
  );

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You don't have access to this page as a {user.role}
          </p>
          <a href="/" className="text-primary hover:underline">
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/login" element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute requiredPaths={['/dashboard']}>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/exchange-lodging" 
                element={
                  <ProtectedRoute requiredPaths={['/exchange-lodging']}>
                    <ExchangeLodging />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/warehouse" 
                element={
                  <ProtectedRoute requiredPaths={['/warehouse']}>
                    <Warehouse />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/invoicing" 
                element={
                  <ProtectedRoute requiredPaths={['/invoicing']}>
                    <Invoicing />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/users" 
                element={
                  <ProtectedRoute requiredPaths={['/users']}>
                    <Users />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/ticket/:id" 
                element={
                  <ProtectedRoute requiredPaths={['/ticket']}>
                    <TicketDetail />
                  </ProtectedRoute>
                } 
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

const App = () => {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
};

export default App;
