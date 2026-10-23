import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { AuthProvider } from "@/hooks/useAuth";
import { UserProvider, useUser } from "@/contexts/UserContext";
import AuthScreens from '@/pages/auth_screens/AuthScreens';
import NotFound from '@/pages/NotFound';
import ErrorBoundary from '@/components/ErrorBoundary';
import Layout from '@/components/Layout';
import { useBodyPointerEventsGuard } from '@/hooks/useBodyPointerEventsGuard';
import { PageLoader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/button';
import { roleLabel } from '@/lib/navigation';
import { useAccess } from '@/hooks/useAccess';

// Pages load on demand so the first paint (login, dashboard) stays small.
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Exchanges = lazy(() => import('@/pages/Exchanges/ExchangesList'));
const NewExchange = lazy(() => import('@/pages/Exchanges/NewExchange'));
const ExchangeDetail = lazy(() => import('@/pages/Exchanges/ExchangeDetail'));
const Orders = lazy(() => import('@/pages/Orders/Orders'));
const Warehouse = lazy(() => import('@/pages/Warehouse'));
const Shipments = lazy(() => import('@/pages/Shipments'));
const Cases = lazy(() => import('@/pages/Cases/Cases'));
const Finance = lazy(() => import('@/pages/Finance/Finance'));
const Users = lazy(() => import('@/pages/Users'));
const Settings = lazy(() => import('@/pages/Settings/Settings'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

function AccessDenied() {
  const { user } = useUser();
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground"><ShieldAlert className="size-6" /></div>
        <h1 className="text-xl font-semibold">This page isn’t part of your role</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          You’re signed in as {roleLabel(user?.role)}. Ask an admin if you need access.
        </p>
        <Button asChild variant="secondary"><Link to="/dashboard">Go to dashboard</Link></Button>
      </div>
    </Layout>
  );
}

function ProtectedRoute({ children, path }: { children: React.ReactNode; path: string }) {
  const { user, isLoading } = useUser();
  const location = useLocation();
  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <RoleGate path={path}>{children}</RoleGate>;
}

/** Mounted only once signed in, so the role permissions are read with a real session. */
function RoleGate({ children, path }: { children: React.ReactNode; path: string }) {
  const access = useAccess();
  if (access.isLoading) return <PageLoader />;
  if (!access.canOpen(path)) return <AccessDenied />;
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// Radix modal layers lock `pointer-events: none` onto <body> while open. If a
// layer is unmounted instead of closed, or two layers overlap (a menu item that
// opens a sheet), the lock can outlive every overlay and freeze the whole page.
// The guard watches <body> and releases a lock that no open overlay backs; the
// route effect covers navigations that unmount a layer mid-flight.
function BodyPointerEventsFix() {
  const location = useLocation();
  useBodyPointerEventsGuard();
  useEffect(() => {
    document.body.style.removeProperty('pointer-events');
  }, [location.pathname]);
  return null;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  if (isLoading) return <PageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Old /ticket/:id links (emails, bookmarks) keep working. */
function LegacyTicketRedirect() {
  const { id } = useParams();
  return <Navigate to={`/exchanges/${id}`} replace />;
}

const routes: { path: string; element: React.ReactNode; access?: string }[] = [
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/exchanges', element: <Exchanges /> },
  { path: '/exchanges/new', element: <NewExchange /> },
  { path: '/exchanges/:id', element: <ExchangeDetail />, access: '/exchanges/detail' },
  { path: '/orders', element: <Orders /> },
  { path: '/warehouse', element: <Warehouse /> },
  { path: '/shipments', element: <Shipments /> },
  { path: '/cases', element: <Cases /> },
  { path: '/finance', element: <Finance /> },
  { path: '/users', element: <Users /> },
  { path: '/settings', element: <Settings /> },
];

function AppContent() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider delayDuration={300}>
              <BodyPointerEventsFix />
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="/login" element={<PublicRoute><AuthScreens /></PublicRoute>} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                {routes.map((r) => (
                  <Route key={r.path} path={r.path} element={<ProtectedRoute path={r.access ?? r.path}>{r.element}</ProtectedRoute>} />
                ))}
                {/* Legacy URLs */}
                <Route path="/exchange-lodging" element={<Navigate to="/exchanges" replace />} />
                <Route path="/invoicing" element={<Navigate to="/finance" replace />} />
                <Route path="/ticket/:id" element={<LegacyTicketRedirect />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const App = () => (
  <UserProvider>
    <AppContent />
  </UserProvider>
);

export default App;
