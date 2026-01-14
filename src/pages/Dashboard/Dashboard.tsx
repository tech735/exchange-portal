import Layout from '@/components/Layout';
import { useTicketStats, useTickets } from '@/hooks/useTickets';
import { AlertTriangle, CheckCircle, Clock, Package, Receipt, XCircle } from 'lucide-react';
import { KPICard } from './KPICard';
import { RecentTicketsTable } from './RecentTicketsTable';

export default function Dashboard() {
  const { data: stats } = useTicketStats();
  const { data: recentTickets } = useTickets();

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
      <div className="p-8 animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of exchange ticket status</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {kpiCards.map(({ title, value, icon, color }) => (
            <KPICard key={title} title={title} value={value} icon={icon} color={color} />
          ))}
        </div>

        <RecentTicketsTable tickets={recentTickets} />
      </div>
    </Layout>
  );
}
