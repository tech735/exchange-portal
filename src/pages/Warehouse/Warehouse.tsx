import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { ScanLine, Truck, PackageCheck, ClipboardCheck, Send, Download, LayoutGrid, List } from 'lucide-react';
import Layout from '@/components/Layout';
import { PageHeader, ToneBadge, EmptyState, ConfirmDialog, SearchField, ProductThumb } from '@/components/app';
import { Button } from '@/components/ui/button';
import { BookShipmentDialog } from '@/components/exchange/BookShipmentDialog';
import { QcDialog } from '@/components/exchange/QcDialog';
import { useTickets } from '@/hooks/useTickets';
import { useExchangeActions } from '@/hooks/useExchangeActions';
import { useToast } from '@/hooks/use-toast';
import { exportTicketsToCSV } from '@/utils/exportUtils';
import { getExchangeStatus, slaRemaining, type ExchangeStatusKey } from '@/lib/exchangeStatus';
import { useProducts } from '@/hooks/useProducts';
import { describeSwap, swapText } from '@/lib/items';
import type { Ticket } from '@/types/database';
import { cn } from '@/lib/utils';

type ColumnKey = 'TO_BOOK_PICKUP' | 'RETURN_IN_TRANSIT' | 'QC_PENDING' | 'READY_TO_SHIP' | 'SHIPPED';
const COLUMNS: { key: ColumnKey; title: string; icon: React.ElementType; action?: string; empty: string }[] = [
  { key: 'TO_BOOK_PICKUP', title: 'To book pickup', icon: Truck, action: 'Book pickup', empty: 'No pickups to book' },
  { key: 'RETURN_IN_TRANSIT', title: 'Return in transit', icon: PackageCheck, action: 'Mark received', empty: 'Nothing on the way' },
  { key: 'QC_PENDING', title: 'Quality check', icon: ClipboardCheck, action: 'Start QC', empty: 'Nothing to check' },
  { key: 'READY_TO_SHIP', title: 'Ready to ship', icon: Send, action: 'Ship replacement', empty: 'Nothing to ship' },
  { key: 'SHIPPED', title: 'Shipped (7 days)', icon: Send, empty: 'Nothing shipped this week' },
];

function age(t: Ticket, key: ColumnKey) {
  const ref = key === 'RETURN_IN_TRANSIT' ? t.return_booked_at : key === 'QC_PENDING' ? t.return_received_at : key === 'READY_TO_SHIP' ? t.warehouse_approved_at : key === 'SHIPPED' ? t.exchange_booked_at : t.exchange_completed_at;
  return ref ? new Date(ref) : new Date(t.updated_at);
}

export default function Warehouse() {
  const { toast } = useToast();
  const { data: tickets = [], isLoading } = useTickets();
  const { data: products = [] } = useProducts();
  const actions = useExchangeActions();
  const [q, setQ] = useState('');
  const [scan, setScan] = useState('');
  const [scanMsg, setScanMsg] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [mobileCol, setMobileCol] = useState<ColumnKey>('TO_BOOK_PICKUP');
  const [active, setActive] = useState<{ kind: 'return' | 'replacement' | 'qc' | 'received'; t: Ticket } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => {
    const weekAgo = Date.now() - 7 * 864e5;
    const s = q.trim().toLowerCase();
    const g: Record<ColumnKey, Ticket[]> = { TO_BOOK_PICKUP: [], RETURN_IN_TRANSIT: [], QC_PENDING: [], READY_TO_SHIP: [], SHIPPED: [] };
    for (const t of tickets) {
      const k = getExchangeStatus(t).key as ExchangeStatusKey;
      if (!(k in g)) continue;
      if (k === 'SHIPPED' && (!t.exchange_booked_at || +new Date(t.exchange_booked_at) < weekAgo)) continue;
      if (s && ![t.order_id, t.customer_name, t.customer_phone, t.return_awb, t.exchange_awb].some((v) => v && String(v).toLowerCase().includes(s))) continue;
      g[k as ColumnKey].push(t);
    }
    for (const k of Object.keys(g) as ColumnKey[]) g[k].sort((a, b) => +age(a, k) - +age(b, k));
    return g;
  }, [tickets, q]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast({ title: ok }); setActive(null); }
    catch (e) { toast({ title: 'Couldn’t save', description: (e as Error).message, variant: 'destructive' }); throw e; }
  };

  // Drag & drop: a card can move one step forward; dropping opens that step's dialog.
  const [drag, setDrag] = useState<{ id: string; from: ColumnKey } | null>(null);
  const [over, setOver] = useState<ColumnKey | null>(null);
  const colIndex = (k: ColumnKey) => COLUMNS.findIndex((c) => c.key === k);
  const canDrop = (to: ColumnKey) => !!drag && colIndex(to) === colIndex(drag.from) + 1;
  const onDropTo = (to: ColumnKey) => {
    const d = drag;
    setDrag(null); setOver(null);
    if (!d || colIndex(to) !== colIndex(d.from) + 1) return;
    const t = tickets.find((x) => x.id === d.id);
    if (t) openAction(t);
  };

  const openAction = (t: Ticket) => {
    const k = getExchangeStatus(t).key;
    if (k === 'TO_BOOK_PICKUP') setActive({ kind: 'return', t });
    else if (k === 'RETURN_IN_TRANSIT') setActive({ kind: 'received', t });
    else if (k === 'QC_PENDING') setActive({ kind: 'qc', t });
    else if (k === 'READY_TO_SHIP') setActive({ kind: 'replacement', t });
  };

  /** Scan station: an AWB or order number finds the ticket and runs its next step. */
  const onScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = scan.trim().toUpperCase();
    if (!code) return;
    const t = tickets.find((x) => [x.return_awb, x.exchange_awb, x.order_id].some((v) => v && String(v).toUpperCase() === code))
      ?? tickets.find((x) => x.order_id.toUpperCase().endsWith(code));
    setScan('');
    if (!t) { setScanMsg({ tone: 'danger', text: `No exchange found for “${code}”.` }); return; }
    const k = getExchangeStatus(t).key;
    if (k === 'RETURN_IN_TRANSIT') {
      try {
        await actions.markReceived(t);
        setScanMsg({ tone: 'success', text: `${t.order_id} received · opening quality check` });
        setActive({ kind: 'qc', t: { ...t, stage: 'RETURN_RECEIVED', return_received_at: new Date().toISOString() } });
      } catch (err) { setScanMsg({ tone: 'danger', text: (err as Error).message }); }
    } else if (['TO_BOOK_PICKUP', 'QC_PENDING', 'READY_TO_SHIP'].includes(k)) {
      setScanMsg({ tone: 'warning', text: `${t.order_id} is at “${getExchangeStatus(t).label}”.` });
      openAction(t);
    } else {
      setScanMsg({ tone: 'warning', text: `${t.order_id} is “${getExchangeStatus(t).label}” — nothing to do at the warehouse.` });
    }
    scanRef.current?.focus();
  };

  const Card = ({ t, col }: { t: Ticket; col: (typeof COLUMNS)[number] }) => {
    const since = age(t, col.key);
    const stuck = col.key === 'RETURN_IN_TRANSIT' && Date.now() - +since > 3 * 864e5;
    const sla = slaRemaining(t);
    return (
      <div
        draggable={!!col.action}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); setDrag({ id: t.id, from: col.key }); }}
        onDragEnd={() => { setDrag(null); setOver(null); }}
        className={cn('group rounded-lg border border-border bg-card p-3 shadow-card transition-[border-color,box-shadow,opacity,transform] duration-150 hover:border-input hover:shadow-card-hover',
          col.action && 'cursor-grab active:cursor-grabbing',
          drag?.id === t.id && 'opacity-40 rotate-[1deg] scale-[0.98]')}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <Link to={`/exchanges/${t.id}`} className="shrink-0 text-sm font-semibold text-foreground hover:text-primary">{t.order_id}</Link>
          {stuck ? <ToneBadge tone="danger">Stuck {formatDistanceToNowStrict(since)}</ToneBadge>
            : sla.tone !== 'neutral' && col.key !== 'SHIPPED' ? <ToneBadge tone={sla.tone}>{sla.label}</ToneBadge>
            : <span className="text-[11px] text-faint whitespace-nowrap">{formatDistanceToNowStrict(since, { addSuffix: true })}</span>}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.customer_name}</p>
        {(() => { const sw = describeSwap(t, products); return (
          <div className="mt-2 flex items-center gap-2">
            <ProductThumb src={sw.returnItem?.image ?? sw.exchangeItem?.image} alt={sw.title} size={32} />
            <div className="min-w-0"><p className="truncate text-xs font-medium text-foreground">{sw.title}</p><p className="truncate text-[11px] text-muted-foreground">{sw.detail}{sw.more > 0 ? ` · +${sw.more}` : ''}</p></div>
          </div>
        ); })()}
        {(col.key === 'RETURN_IN_TRANSIT' || col.key === 'SHIPPED') && (t.return_awb || t.exchange_awb) && (
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">AWB {col.key === 'SHIPPED' ? t.exchange_awb : t.return_awb}</p>
        )}
        {col.action && (
          <Button size="sm" variant="secondary" className="mt-2.5 w-full" onClick={() => openAction(t)}>{col.action}</Button>
        )}
      </div>
    );
  };

  const total = COLUMNS.slice(0, 4).reduce((s, c) => s + grouped[c.key].length, 0);

  return (
    <Layout>
      <div className="space-y-5">
        <PageHeader
          title="Warehouse"
          description={isLoading ? 'Loading…' : `${total} active · ${grouped.QC_PENDING.length} waiting for quality check`}
          actions={
            <>
              <Button variant="secondary" onClick={() => exportTicketsToCSV(grouped.TO_BOOK_PICKUP)} disabled={!grouped.TO_BOOK_PICKUP.length}><Download /> Pickup list</Button>
              <div className="hidden md:inline-flex rounded-lg border border-input bg-card p-0.5">
                {(['board', 'list'] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors', view === v ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    {v === 'board' ? <LayoutGrid className="size-4" /> : <List className="size-4" />}{v === 'board' ? 'Board' : 'List'}
                  </button>
                ))}
              </div>
            </>
          }
        />

        {/* Scan station */}
        <form onSubmit={onScan} className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-card p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="relative flex-1">
            <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-primary" />
            <input
              ref={scanRef}
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              placeholder="Scan an AWB or type an order number to receive a return…"
              className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-3 text-base font-medium shadow-sm placeholder:font-normal placeholder:text-faint focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15"
              autoComplete="off"
              aria-label="Scan AWB or order number"
            />
          </div>
          <Button type="submit" size="lg" className="sm:w-auto">Find</Button>
        </form>
        {scanMsg && (
          <p className={cn('-mt-2 rounded-lg px-3 py-2 text-sm animate-fade-in', scanMsg.tone === 'success' ? 'bg-success/10 text-success' : scanMsg.tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive')}>{scanMsg.text}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <SearchField value={q} onChange={setQ} placeholder="Filter by order, customer, AWB…" className="w-full sm:w-72" />
          {view === 'board' && <p className="hidden md:block text-xs text-muted-foreground">Tip: drag a card into the next column to move it forward.</p>}
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">{COLUMNS.map((c) => <div key={c.key} className="h-72 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : view === 'list' ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
            {COLUMNS.slice(0, 4).flatMap((c) => grouped[c.key].map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <Link to={`/exchanges/${t.id}`} className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.order_id} <span className="font-normal text-muted-foreground">· {t.customer_name}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{swapText(t, products)}</p>
                </Link>
                <ToneBadge tone="neutral">{c.title}</ToneBadge>
                {c.action && <Button size="sm" variant="secondary" onClick={() => openAction(t)}>{c.action}</Button>}
              </div>
            )))}
            {total === 0 && <EmptyState icon={PackageCheck} title="Warehouse is clear" description="New work appears here once support records payment." />}
          </div>
        ) : (
          <>
            {/* Phones: one column at a time with a segmented switcher */}
            <div className="md:hidden flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4">
              {COLUMNS.map((c) => (
                <button key={c.key} onClick={() => setMobileCol(c.key)} className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors', mobileCol === c.key ? 'border-primary bg-accent text-accent-foreground' : 'border-input bg-card text-muted-foreground')}>
                  {c.title} · {grouped[c.key].length}
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              {COLUMNS.map((c) => (
                <section
                  key={c.key}
                  onDragOver={(e) => { if (canDrop(c.key)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== c.key) setOver(c.key); } }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === c.key ? null : o)); }}
                  onDrop={(e) => { e.preventDefault(); onDropTo(c.key); }}
                  className={cn('flex min-h-[200px] flex-col rounded-xl bg-muted/70 p-2.5 transition-[background-color,box-shadow,opacity] duration-150',
                    mobileCol !== c.key && 'hidden md:flex',
                    drag && canDrop(c.key) && 'bg-accent ring-2 ring-primary/30',
                    over === c.key && 'ring-primary bg-accent',
                    drag && !canDrop(c.key) && c.key !== drag.from && 'opacity-50')}
                  aria-label={c.title}
                >
                  <header className="flex items-center gap-2 px-1 pb-2.5 pt-1">
                    <c.icon className="size-4 text-muted-foreground" />
                    <h2 className="flex-1 truncate text-sm font-semibold font-sans">{c.title}</h2>
                    <span className="rounded-full bg-card px-2 text-xs font-medium leading-5 text-muted-foreground tabular">{grouped[c.key].length}</span>
                  </header>
                  <div className="flex flex-1 flex-col gap-2">
                    {grouped[c.key].length === 0
                      ? <p className="py-8 text-center text-xs text-faint">{c.empty}</p>
                      : grouped[c.key].map((t) => <Card key={t.id} t={t} col={c} />)}
                    {drag && canDrop(c.key) && (
                      <div className={cn('grid place-items-center rounded-lg border-2 border-dashed py-6 text-xs font-medium transition-colors', over === c.key ? 'border-primary text-primary' : 'border-primary/30 text-muted-foreground')}>
                        Drop to {COLUMNS[colIndex(drag.from)].action?.toLowerCase()}
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>

      <BookShipmentDialog
        open={active?.kind === 'return' || active?.kind === 'replacement'}
        onOpenChange={(o) => !o && setActive(null)}
        kind={active?.kind === 'replacement' ? 'replacement' : 'return'}
        orderLabel={active ? `${active.t.order_id}` : ''}
        context={active?.t.notes}
        onSubmit={(agg, awb) => active!.kind === 'replacement'
          ? run(() => actions.bookReplacement(active!.t, agg, awb), 'Replacement shipment booked')
          : run(() => actions.bookReturn(active!.t, agg, awb), 'Return pickup booked')}
      />
      <QcDialog
        ticket={active?.kind === 'qc' ? active.t : null}
        open={active?.kind === 'qc'}
        onOpenChange={(o) => { if (!o) { setActive(null); scanRef.current?.focus(); } }}
        onSubmit={(d, notes, checklist, photos) => run(() => actions.recordQc(active!.t, d, notes, checklist, photos), d === 'APPROVED' ? 'QC approved · ready to ship' : 'Return rejected')}
      />
      <ConfirmDialog
        open={active?.kind === 'received'}
        onOpenChange={(o) => !o && setActive(null)}
        title={`Mark ${active?.t.order_id} as received?`}
        description="Tip: scanning the AWB in the box above does this and opens QC in one step."
        confirmLabel="Mark received"
        loading={actions.pending}
        onConfirm={() => run(() => actions.markReceived(active!.t), 'Return received').catch(() => {})}
      />
    </Layout>
  );
}
