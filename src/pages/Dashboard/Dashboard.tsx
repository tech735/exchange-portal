import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNowStrict, startOfDay, subDays, isSameDay, startOfMonth } from 'date-fns';
import { ArrowRight, Plus, Inbox, CheckCircle2 } from 'lucide-react';
import Layout from '@/components/Layout';
import { KpiCard, SectionCard, ToneBadge, EmptyState, formatINR, initials } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTickets } from '@/hooks/useTickets';
import { useRecentActivity } from '@/hooks/useActivity';
import { useUser } from '@/contexts/UserContext';
import { canAccess } from '@/lib/navigation';
import { getExchangeStatus, slaRemaining, OPEN_STATUSES } from '@/lib/exchangeStatus';
import { itemSummary } from '@/pages/Exchanges/ExchangesList';
import { EVENT_LABELS, REASON_LABELS, type ReasonCode } from '@/types/database';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user, hasFullAccess } = useUser();
  const full = hasFullAccess() || user?.role === 'ADMIN';
  const role = user?.role;
  const { data: tickets = [], isLoading } = useTickets();
  const { data: activity = [] } = useRecentActivity();
  const can = (p: string) => canAccess(role, p, full);

  const m = useMemo(() => {
    const now = Date.now();
    const withStatus = tickets.map((t) => ({ t, s: getExchangeStatus(t), sla: slaRemaining(t, now) }));
    const open = withStatus.filter((x) => OPEN_STATUSES.includes(x.s.key));
    const needsPay = withStatus.filter((x) => x.s.key === 'REQUESTED' || x.s.key === 'AWAITING_PAYMENT');
    const warehouse = withStatus.filter((x) => ['TO_BOOK_PICKUP', 'RETURN_IN_TRANSIT', 'QC_PENDING', 'READY_TO_SHIP'].includes(x.s.key));
    const refunds = withStatus.filter((x) => x.s.key === 'REFUND_DUE');
    const breached = open.filter((x) => x.t.sla_breached);
    const atRisk = open.filter((x) => x.sla.tone !== 'neutral').sort((a, b) => a.sla.hours - b.sla.hours);
    const team = role === 'WAREHOUSE' ? 'warehouse' : role === 'INVOICING' ? 'finance' : role === 'SUPPORT' ? 'support' : null;
    const queue = open.filter((x) => x.s.nextAction && (full || x.s.nextAction.team === team)).sort((a, b) => a.sla.hours - b.sla.hours);

    const days = Array.from({ length: 14 }, (_, i) => startOfDay(subDays(new Date(), 13 - i)));
    const perDay = days.map((d) => ({ d, n: tickets.filter((t) => isSameDay(new Date(t.created_at), d)).length }));
    const monthStart = startOfMonth(new Date());
    const thisMonth = tickets.filter((t) => new Date(t.created_at) >= monthStart);
    const reasons = Object.entries(thisMonth.reduce<Record<string, number>>((acc, t) => { acc[t.reason_code] = (acc[t.reason_code] || 0) + 1; return acc; }, {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      open, needsPay, warehouse, refunds, breached, atRisk, queue, perDay, reasons, monthTotal: thisMonth.length,
      refundTotal: refunds.reduce((s, x) => s + (x.t.refund_amount || 0), 0),
      qc: withStatus.filter((x) => x.s.key === 'QC_PENDING').length,
    };
  }, [tickets, role, full]);

  const maxDay = Math.max(1, ...m.perDay.map((d) => d.n));
  const first = (user?.name || '').split(' ')[0];

  const kpis = [
    { label: 'Open exchanges', value: m.open.length, meta: `${m.monthTotal} lodged this month`, to: can('/exchanges') ? '/exchanges' : undefined },
    { label: 'Needs payment', value: m.needsPay.length, meta: 'Requested or link sent', to: can('/exchanges') ? '/exchanges?view=needs-payment' : undefined, tone: m.needsPay.length ? 'warning' as const : undefined },
    { label: 'In warehouse', value: m.warehouse.length, meta: `${m.qc} waiting for QC`, to: can('/warehouse') ? '/warehouse' : undefined },
    { label: 'SLA breached', value: m.breached.length, meta: `${m.atRisk.length} at risk`, to: can('/exchanges') ? '/exchanges?view=breached' : undefined, tone: m.breached.length ? 'danger' as const : undefined },
    { label: 'Refunds due', value: m.refunds.length, meta: m.refunds.length ? `${formatINR(m.refundTotal)} to send` : 'All settled', to: can('/finance') ? '/finance?tab=refunds' : undefined },
  ];

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">{greeting()}{first ? `, ${first}` : ''}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, d MMM')} · {isLoading ? 'Loading your queue…' : m.queue.length ? `${m.queue.length} thing${m.queue.length === 1 ? '' : 's'} need you` : 'Your queue is clear'}
            </p>
          </div>
          {can('/exchanges/new') && <Button asChild><Link to="/exchanges/new"><Plus /> New exchange</Link></Button>}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => <KpiCard key={k.label} label={k.label} value={k.value} meta={k.meta} to={k.to} tone={k.tone} loading={isLoading} />)}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <SectionCard
            title={`My queue${m.queue.length ? ` · ${m.queue.length}` : ''}`}
            description={full ? 'Next action on every open exchange, most urgent first' : 'Next actions for your team, most urgent first'}
            action={m.queue.length > 6 && can('/exchanges') ? <Link to="/exchanges" className="text-xs font-medium text-primary hover:underline">View all</Link> : undefined}
            bodyClassName="px-0 sm:px-0 pb-1"
          >
            {isLoading ? (
              <div className="space-y-2 px-5 pb-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
            ) : m.queue.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nothing waiting on you" description="New work lands here as soon as it’s your team’s turn." />
            ) : (
              <ul className="divide-y divide-border">
                {m.queue.slice(0, 6).map(({ t, s, sla }) => (
                  <li key={t.id}>
                    <Link to={`/exchanges/${t.id}`} className="group flex items-center gap-3 px-4 sm:px-5 py-3 transition-colors hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{s.nextAction!.label} <span className="font-normal text-muted-foreground">· #{t.order_id}</span></p>
                        <p className="truncate text-xs text-muted-foreground">{t.customer_name} · {itemSummary(t)}</p>
                      </div>
                      <ToneBadge tone={sla.tone}>{sla.label}</ToneBadge>
                      <ArrowRight className="size-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="SLA at risk" bodyClassName="pb-3">
            {m.atRisk.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No exchanges close to their SLA.</p>
            ) : (
              <ul className="space-y-1">
                {m.atRisk.slice(0, 6).map(({ t, s, sla }) => (
                  <li key={t.id}>
                    <Link to={`/exchanges/${t.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 transition-colors hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">#{t.order_id}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                      </div>
                      <ToneBadge tone={sla.tone}>{sla.label}</ToneBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_320px_340px]">
          <SectionCard title="Exchanges lodged" description="Last 14 days" className="md:col-span-2 xl:col-span-1">
            <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Exchanges lodged per day, last 14 days">
              {m.perDay.map(({ d, n }) => (
                <Tooltip key={d.toISOString()}>
                  <TooltipTrigger asChild>
                    <div className="group flex h-full flex-1 flex-col justify-end">
                      <div className="rounded-t-md bg-primary/80 transition-colors duration-150 group-hover:bg-primary" style={{ height: `${Math.max(4, (n / maxDay) * 100)}%`, opacity: n ? 1 : 0.25 }} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{format(d, 'EEE d MMM')} · {n} exchange{n === 1 ? '' : 's'}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-faint"><span>{format(m.perDay[0].d, 'd MMM')}</span><span>Today</span></div>
          </SectionCard>

          <SectionCard title="Top reasons" description="This month">
            {m.reasons.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No exchanges this month yet.</p> : (
              <ul className="space-y-3">
                {m.reasons.map(([r, n]) => {
                  const pct = Math.round((n / m.monthTotal) * 100);
                  return (
                    <li key={r}>
                      <div className="flex justify-between text-xs"><span className="font-medium text-foreground">{REASON_LABELS[r as ReasonCode] ?? r}</span><span className="text-muted-foreground tabular">{pct}%</span></div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Recent activity">
            {activity.length === 0 ? <EmptyState icon={Inbox} title="No activity yet" className="py-6" /> : (
              <ul className="space-y-3">
                {activity.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link to={`/exchanges/${a.ticketId}`} className="flex items-start gap-3 rounded-lg -mx-2 px-2 py-1 hover:bg-muted/50 transition-colors">
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">{initials(a.customerName)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{EVENT_LABELS[a.eventType]} <span className="text-muted-foreground">· #{a.orderId}</span></p>
                        <p className="text-[11px] text-faint">{formatDistanceToNowStrict(new Date(a.eventAt), { addSuffix: true })}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </Layout>
  );
}

