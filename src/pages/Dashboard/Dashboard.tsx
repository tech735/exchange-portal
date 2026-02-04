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
      <div className="page-shell animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Command Center</p>
            <h1 className="text-3xl font-semibold text-foreground mt-2">Dashboard</h1>
            <p className="text-muted-foreground mt-2">Overview of exchange ticket status</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" />
            Live operational view
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-6">
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
            <div className="h-56 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-blue-100/70" />
          </div>
          <div className="xl:col-span-4 card-base flex flex-col justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Reminder</p>
              <h3 className="text-2xl font-semibold mt-3">Follow up on pending exchanges</h3>
              <p className="text-sm text-muted-foreground mt-2">Keep tickets moving to maintain SLA confidence.</p>
            </div>
            <button className="mt-6 w-full rounded-full bg-primary text-primary-foreground py-2 text-sm font-medium shadow-sm">
              Review Pending Items
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7">
            <RecentTicketsTable tickets={recentTickets} />
          </div>
          <div className="xl:col-span-5 grid gap-6">
            <div className="card-base">
              <p className="text-sm text-muted-foreground">Team Collaboration</p>
              <h3 className="text-xl font-semibold mt-2">Active Coordination</h3>
              <div className="mt-4 space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                        KT
                      </div>
                      <div>
                        <p className="text-sm font-medium">Support Queue</p>
                        <p className="text-xs text-muted-foreground">Awaiting review</p>
                      </div>
                    </div>
                    <span className="text-xs rounded-full bg-accent px-3 py-1 text-muted-foreground">In progress</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card-base flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <h3 className="text-3xl font-semibold mt-2">76%</h3>
                <p className="text-xs text-muted-foreground mt-1">Weekly completion</p>
              </div>
              <div className="h-24 w-24 rounded-full border-8 border-primary/20 flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">76%</div>
              </div>
            </div>
            <div className="rounded-2xl p-6 bg-slate-900 text-white shadow-lg">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Time Tracker</p>
              <h3 className="text-2xl font-semibold mt-3">6h 42m</h3>
              <p className="text-sm text-slate-300 mt-1">Active exchange processing</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
