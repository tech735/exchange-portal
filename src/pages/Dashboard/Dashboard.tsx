import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, differenceInHours, format, isWithinInterval, startOfDay, subDays } from 'date-fns';
import { ArrowRight, CheckCircle2, Plus } from 'lucide-react';
import Layout from '@/components/Layout';
import { SectionCard, ToneBadge, EmptyState, initials } from '@/components/app';
import { Button } from '@/components/ui/button';
import { useTickets } from '@/hooks/useTickets';
import { useUser } from '@/contexts/UserContext';
import { canAccess } from '@/lib/navigation';
import { getExchangeStatus, slaRemaining, OPEN_STATUSES, type ExchangeStatusKey } from '@/lib/exchangeStatus';
import { REASON_LABELS, type ReasonCode, type Ticket } from '@/types/database';
import { cn } from '@/lib/utils';
import { BarList, Ring, SERIES, Sparkline, StageDonut, VolumeChart, type Slice, type VolumePoint } from './charts';

type Range = 7 | 30 | 90;
const RANGE_KEY = 'dashboard-range';
// Same windows the hourly escalate-tickets job uses for the warehouse SLA.
const WAREHOUSE_SLA_DAYS = 5;
const REQUEST_SLA_DAYS = 7;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** When an exchange counts as done: replacement shipped, or closed. */
const completedAt = (t: Ticket) => t.exchange_booked_at ?? t.closed_at;

function pctChange(now: number, prev: number) {
  if (!prev) return now ? null : 0;
  return Math.round(((now - prev) / prev) * 100);
}

function DeltaBadge({ value, unit = '%', goodWhen }: { value: number | null; unit?: string; goodWhen: 'up' | 'down' | 'none' }) {
  if (value === null) return <ToneBadge tone="neutral" dot={false}>New</ToneBadge>;
  if (value === 0) return <ToneBadge tone="neutral" dot={false}>No change</ToneBadge>;
  const up = value > 0;
  const tone = goodWhen === 'none' ? 'neutral' : (up === (goodWhen === 'up')) ? 'success' : 'danger';
  return <ToneBadge tone={tone} dot={false}>{up ? '↑' : '↓'} {Math.abs(value)}{unit}</ToneBadge>;
}

function KpiTile({ label, value, delta, foot, spark, color, id, to }: { label: string; value: React.ReactNode; delta: React.ReactNode; foot: string; spark: number[]; color: string; id: string; to?: string }) {
  const body = (
    <>
      <p className="truncate text-xs font-medium text-muted-foreground" title={label}>{label}</p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="font-heading text-[22px] sm:text-[28px] font-semibold leading-tight tabular whitespace-nowrap">{value}</p>
        {delta}
      </div>
      <Sparkline data={spark} color={color} id={id} />
      <p className="mt-1 truncate text-[11px] text-faint">{foot}</p>
    </>
  );
  const cls = 'block min-w-0 rounded-2xl border border-border bg-card p-3.5 sm:p-5 transition-[border-color,box-shadow] duration-150';
  return to
    ? <Link to={to} className={cn(cls, 'hover:border-input hover:shadow-card-hover')}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

export default function Dashboard() {
  const { user, hasFullAccess } = useUser();
  const full = hasFullAccess() || user?.role === 'ADMIN';
  const role = user?.role;
  const can = (p: string) => canAccess(role, p, full);
  const { data: tickets = [], isLoading } = useTickets();
  const [range, setRange] = useState<Range>(() => {
    try { const v = Number(localStorage.getItem(RANGE_KEY)); return v === 7 || v === 90 ? v : 30; } catch { return 30; }
  });
  const pickRange = (r: Range) => { setRange(r); try { localStorage.setItem(RANGE_KEY, String(r)); } catch { /* storage blocked */ } };

  const m = useMemo(() => {
    const now = new Date();
    const end = now;
    const start = startOfDay(subDays(now, range - 1));
    const prevStart = subDays(start, range);
    const inCur = (d?: string | null) => !!d && isWithinInterval(new Date(d), { start, end });
    const inPrev = (d?: string | null) => !!d && isWithinInterval(new Date(d), { start: prevStart, end: start });

    // Daily series for the period
    const days = Array.from({ length: range }, (_, i) => addDays(start, i));
    const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
    const bump = (map: Map<string, number>, d: string) => { const k = dayKey(new Date(d)); map.set(k, (map.get(k) ?? 0) + 1); };
    const lodgedBy = new Map<string, number>(), doneBy = new Map<string, number>(), breachBy = new Map<string, number>();
    for (const t of tickets) {
      if (inCur(t.created_at)) bump(lodgedBy, t.created_at);
      const c = completedAt(t);
      if (c && inCur(c)) bump(doneBy, c);
      if (t.sla_breached_at && inCur(t.sla_breached_at)) bump(breachBy, t.sla_breached_at);
    }
    const volume: VolumePoint[] = days.map((d) => ({ date: d, lodged: lodgedBy.get(dayKey(d)) ?? 0, completed: doneBy.get(dayKey(d)) ?? 0 }));

    const lodged = tickets.filter((t) => inCur(t.created_at)).length;
    const lodgedPrev = tickets.filter((t) => inPrev(t.created_at)).length;
    const doneCur = tickets.filter((t) => inCur(completedAt(t)));
    const done = doneCur.length;
    const donePrev = tickets.filter((t) => inPrev(completedAt(t))).length;

    // Turnaround: days from request to replacement shipped
    const turn = (list: Ticket[]) => {
      const hrs = list.filter((t) => t.exchange_booked_at).map((t) => differenceInHours(new Date(t.exchange_booked_at!), new Date(t.created_at)));
      return hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length / 24 : null;
    };
    const turnCur = turn(doneCur);
    const turnPrev = turn(tickets.filter((t) => inPrev(completedAt(t))));
    // Turnaround trend: average per bucket across the period (14 buckets max)
    const buckets = Math.min(14, range);
    const per = range / buckets;
    const turnSpark = Array.from({ length: buckets }, (_, b) => {
      const bs = addDays(start, Math.floor(b * per)), be = addDays(start, Math.floor((b + 1) * per));
      return turn(doneCur.filter((t) => { const c = new Date(completedAt(t)!); return c >= bs && c < be; })) ?? 0;
    });

    const withStatus = tickets.map((t) => ({ t, s: getExchangeStatus(t), sla: slaRemaining(t) }));
    const open = withStatus.filter((x) => OPEN_STATUSES.includes(x.s.key));
    const breachedOpen = open.filter((x) => x.t.sla_breached).length;
    const newBreaches = tickets.filter((t) => inCur(t.sla_breached_at)).length;

    const bucketOf = (k: ExchangeStatusKey): 'pay' | 'wh' | 'inv' | 'refund' =>
      ['REQUESTED', 'AWAITING_PAYMENT', 'ESCALATED'].includes(k) ? 'pay'
        : ['TO_BOOK_PICKUP', 'RETURN_IN_TRANSIT', 'QC_PENDING', 'READY_TO_SHIP'].includes(k) ? 'wh'
          : k === 'REFUND_DUE' ? 'refund' : 'inv';
    const counts = { pay: 0, wh: 0, inv: 0, refund: 0 };
    for (const x of open) counts[bucketOf(x.s.key)]++;

    // On time = replacement shipped within the warehouse SLA: 5 days from the return
    // pickup being booked (7 days from the request if no pickup was recorded).
    // Not the sla_breached flag: that is also set later when invoicing / closing
    // lags, which says nothing about whether the customer got their item on time.
    const shipped = doneCur.filter((t) => t.exchange_booked_at);
    const dueBy = (t: Ticket) => t.return_booked_at
      ? addDays(new Date(t.return_booked_at), WAREHOUSE_SLA_DAYS)
      : addDays(new Date(t.created_at), REQUEST_SLA_DAYS);
    const onTime = shipped.filter((t) => new Date(t.exchange_booked_at!) <= dueBy(t)).length;
    const reasons = Object.entries(tickets.filter((t) => inCur(t.created_at)).reduce<Record<string, number>>((a, t) => { a[t.reason_code] = (a[t.reason_code] ?? 0) + 1; return a; }, {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ label: REASON_LABELS[k as ReasonCode] ?? k, value: v }));

    const team = role === 'WAREHOUSE' ? 'warehouse' : role === 'INVOICING' ? 'finance' : role === 'SUPPORT' ? 'support' : null;
    const queue = open.filter((x) => x.s.nextAction && (full || x.s.nextAction.team === team)).sort((a, b) => a.sla.hours - b.sla.hours);

    return {
      volume, lodged, lodgedPrev, done, donePrev, turnCur, turnPrev, turnSpark, breachedOpen, newBreaches,
      breachSpark: days.map((d) => breachBy.get(dayKey(d)) ?? 0),
      lodgedSpark: volume.map((v) => v.lodged), doneSpark: volume.map((v) => v.completed),
      counts, onTime, late: shipped.length - onTime, shippedCount: shipped.length, reasons, queue,
    };
  }, [tickets, range, role, full]);

  const slices: Slice[] = [
    { key: 'pay', label: 'Needs payment', value: m.counts.pay, color: SERIES.indigo, to: can('/exchanges') ? '/exchanges?view=needs-payment' : undefined },
    { key: 'wh', label: 'In warehouse', value: m.counts.wh, color: SERIES.azure, to: can('/warehouse') ? '/warehouse' : undefined },
    { key: 'inv', label: 'Shipped · to invoice', value: m.counts.inv, color: SERIES.aqua, to: can('/finance') ? '/finance' : undefined },
    { key: 'refund', label: 'Refund due', value: m.counts.refund, color: SERIES.amber, to: can('/finance') ? '/finance?tab=refunds' : undefined },
  ];
  const first = (user?.name || '').split(' ')[0];
  const periodLabel = `last ${range} days`;
  const turnDelta = m.turnCur !== null && m.turnPrev !== null ? Math.round((m.turnCur - m.turnPrev) * 10) / 10 : null;

  return (
    <Layout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold">{greeting()}{first ? `, ${first}` : ''}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, d MMM')} · {isLoading ? 'Loading…' : m.queue.length ? `${m.queue.length} thing${m.queue.length === 1 ? '' : 's'} need you` : 'Your queue is clear'}
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div role="radiogroup" aria-label="Period" className="flex flex-1 rounded-lg bg-muted p-0.5 sm:inline-flex sm:flex-none">
              {([7, 30, 90] as Range[]).map((r) => (
                <button key={r} role="radio" aria-checked={range === r} onClick={() => pickRange(r)}
                  className={cn('h-8 flex-1 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-all duration-150 sm:flex-none', range === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {r}<span className="hidden min-[360px]:inline"> days</span><span className="min-[360px]:hidden">d</span>
                </button>
              ))}
            </div>
            {can('/exchanges/new') && <Button asChild className="shrink-0 sm:hidden" size="sm" aria-label="New exchange"><Link to="/exchanges/new"><Plus /><span className="hidden min-[360px]:inline">New</span></Link></Button>}
          </div>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {isLoading ? [0, 1, 2, 3].map((i) => <div key={i} className="h-[168px] rounded-2xl bg-muted animate-pulse" />) : (
            <>
              <KpiTile id="lodged" label="Exchanges lodged" value={m.lodged} color={SERIES.indigo} spark={m.lodgedSpark}
                delta={<DeltaBadge value={pctChange(m.lodged, m.lodgedPrev)} goodWhen="none" />} foot={`${periodLabel} · vs previous ${range}`} to={can('/exchanges') ? '/exchanges?view=all' : undefined} />
              <KpiTile id="done" label="Completed" value={m.done} color={SERIES.aqua} spark={m.doneSpark}
                delta={<DeltaBadge value={pctChange(m.done, m.donePrev)} goodWhen="up" />} foot="replacement shipped or closed" />
              <KpiTile id="turn" label="Avg. turnaround" value={m.turnCur === null ? '—' : `${m.turnCur.toFixed(1)} days`} color={SERIES.azure} spark={m.turnSpark}
                delta={<DeltaBadge value={turnDelta} unit=" d" goodWhen="down" />} foot="request → replacement shipped" />
              <KpiTile id="sla" label="SLA breached" value={m.breachedOpen} color={SERIES.critical} spark={m.breachSpark}
                delta={m.newBreaches ? <ToneBadge tone="danger" dot={false}>+{m.newBreaches} new</ToneBadge> : <ToneBadge tone="success" dot={false}>None new</ToneBadge>}
                foot="open exchanges past their SLA" to={can('/exchanges') ? '/exchanges?view=breached' : undefined} />
            </>
          )}
        </div>

        {/* Volume + where things are */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <SectionCard
            title="Exchange volume"
            description={`Lodged vs completed per day · ${periodLabel}`}
            action={
              <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SERIES.indigo }} />Lodged</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SERIES.aqua }} />Completed</span>
              </div>
            }
          >
            {isLoading ? <div className="h-64 rounded-lg bg-muted animate-pulse" /> : <VolumeChart data={m.volume} />}
          </SectionCard>
          <SectionCard title="Where open exchanges are" description="Click a stage to open it">
            {isLoading ? <div className="h-72 rounded-lg bg-muted animate-pulse" /> : <StageDonut slices={slices} />}
          </SectionCard>
        </div>

        {/* Rate · reasons · needs attention */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[300px_minmax(0,1fr)_400px]">
          <SectionCard title="On-time rate" description={`Replacement shipped within ${WAREHOUSE_SLA_DAYS} days of pickup · ${periodLabel}`}>
            <Ring value={m.shippedCount ? m.onTime / m.shippedCount : null} label={m.shippedCount ? 'on time' : 'nothing shipped'} />
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-muted/60 py-2"><p className="font-heading text-lg font-semibold tabular">{m.onTime}</p><p className="text-[11px] text-muted-foreground">On time</p></div>
              <div className="rounded-lg bg-muted/60 py-2"><p className="font-heading text-lg font-semibold tabular">{m.late}</p><p className="text-[11px] text-muted-foreground">Late</p></div>
            </div>
          </SectionCard>

          <SectionCard title="Why customers exchange" description={periodLabel}>
            <BarList rows={m.reasons} empty="No exchanges in this period." />
          </SectionCard>

          <SectionCard
            title="Needs attention"
            className="md:col-span-2 xl:col-span-1"
            action={m.queue.length > 5 && can('/exchanges') ? <Link to="/exchanges" className="text-xs font-medium text-primary hover:underline">View all {m.queue.length}</Link> : undefined}
            bodyClassName="px-2 sm:px-3 pb-2"
          >
            {m.queue.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nothing waiting on you" className="py-8" />
            ) : (
              <ul>
                {m.queue.slice(0, 5).map(({ t, s, sla }) => (
                  <li key={t.id}>
                    <Link to={`/exchanges/${t.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">{initials(t.customer_name)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{s.nextAction!.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.order_id}</p>
                        <ToneBadge tone={sla.tone} className="mt-1 sm:hidden">{sla.label}</ToneBadge>
                      </div>
                      <ToneBadge tone={sla.tone} className="hidden sm:inline-flex">{sla.label}</ToneBadge>
                      <ArrowRight className="size-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
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
