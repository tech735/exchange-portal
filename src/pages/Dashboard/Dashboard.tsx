import Layout from '@/components/Layout';
import { useTicketStats } from '@/hooks/useTickets';
import { useUser } from '@/contexts/UserContext';
import { AlertTriangle, CheckCircle, ChevronRight, Clock, Package, Receipt, XCircle } from 'lucide-react';
import { KPICard } from './KPICard';
import { SlaBreachedTable } from './SlaBreachedTable';
import { OperationalOverview } from './OperationalOverview';
import { TeamCollaboration } from './TeamCollaboration';
import { WeeklyProgress } from './WeeklyProgress';
import { ProductSyncButton } from '@/components/ProductSyncButton';
import { PendingItemsDialog } from './PendingItemsDialog';
import { useState } from 'react';

export default function Dashboard() {
  const { data: stats } = useTicketStats();
  const { user } = useUser();
  const [isPendingDialogOpen, setIsPendingDialogOpen] = useState(false);

  const kpiCards = [
    { title: 'Total Open', value: stats?.totalOpen ?? 0, icon: Package, color: 'text-info' },
    { title: 'Pending Warehouse', value: stats?.pendingWarehouse ?? 0, icon: Clock, color: 'text-warning' },
    { title: 'Pending Invoicing', value: stats?.pendingInvoicing ?? 0, icon: Receipt, color: 'text-stage-invoicing' },
    { title: 'SLA Breached', value: stats?.slaBreached ?? 0, icon: AlertTriangle, color: 'text-destructive' },
    { title: 'Completed This Week', value: stats?.completedThisWeek ?? 0, icon: CheckCircle, color: 'text-success' },
    { title: 'Denied', value: stats?.denied ?? 0, icon: XCircle, color: 'text-muted-foreground' },
  ];

  return (
    <Layout>
      <div className="page-shell animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <span>Home</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground/70">Dashboard</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
              Welcome back{user?.name ? `, ${user.name}` : ''}
            </h1>
            <p className="text-muted-foreground mt-2">Overview of exchange ticket status</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success" />
              Live operational view
            </div>
            <button
              onClick={() => setIsPendingDialogOpen(true)}
              className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
            >
              Review Pending Items
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
          {kpiCards.map(({ title, value, icon, color }, index) => (
            <KPICard
              key={title}
              title={title}
              value={value}
              icon={icon}
              color={color}
              variant={index === 0 ? 'primary' : 'default'}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 card-base">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Operational Overview</h2>
              <p className="text-sm text-muted-foreground">Live exchange activity</p>
            </div>
            <OperationalOverview />
          </div>
          <div className="xl:col-span-4">
            <TeamCollaboration className="h-full" />
          </div>
        </div>

        <PendingItemsDialog
          open={isPendingDialogOpen}
          onOpenChange={setIsPendingDialogOpen}
        />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7">
            <SlaBreachedTable />
          </div>
          <div className="xl:col-span-5 grid gap-6">
            <ProductSyncButton />
            <WeeklyProgress />
          </div>
        </div>
      </div>
    </Layout>
  );
}
