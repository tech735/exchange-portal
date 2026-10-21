import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChevronRight, Download, MoreHorizontal, Plus, Repeat2, Trash2, CheckCircle2, ExternalLink, SlidersHorizontal } from 'lucide-react';
import Layout from '@/components/Layout';
import {
  PageHeader, ViewTabs, SearchField, FilterChip, BulkBar, BulkBarButton, EmptyState, RowSkeleton,
  StatusBadge, PaymentBadge, ToneBadge, ConfirmDialog, formatINR,
} from '@/components/app';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTickets, useDeleteTicket } from '@/hooks/useTickets';
import { useExchangeActions } from '@/hooks/useExchangeActions';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { exportTicketsToCSV } from '@/utils/exportUtils';
import { getExchangeStatus, slaRemaining, EXCHANGE_QUEUES, OPEN_STATUSES, REQUEST_SOURCE_LABELS, type RequestSource } from '@/lib/exchangeStatus';
import { REASON_LABELS, type ReasonCode, type Ticket } from '@/types/database';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

type ViewId = 'open' | 'needs-payment' | 'to-book' | 'in-transit' | 'qc' | 'ready' | 'finance' | 'breached' | 'closed' | 'all';

const VIEWS: { id: ViewId; label: string; match: (t: Ticket) => boolean }[] = [
  { id: 'open', label: 'All open', match: (t) => OPEN_STATUSES.includes(getExchangeStatus(t).key) },
  ...EXCHANGE_QUEUES.filter((q) => q.id !== 'closed').map((q) => ({
    id: q.id as ViewId,
    label: q.label,
    match: (t: Ticket) => q.statuses.includes(getExchangeStatus(t).key),
  })),
  { id: 'breached', label: 'SLA breached', match: (t) => t.sla_breached && getExchangeStatus(t).key !== 'CLOSED' },
  { id: 'closed', label: 'Closed', match: (t) => ['CLOSED', 'REJECTED'].includes(getExchangeStatus(t).key) },
  { id: 'all', label: 'All', match: () => true },
];

type SortId = 'sla' | 'newest' | 'oldest';

export function itemSummary(t: Ticket) {
  const r = t.return_items?.[0];
  const e = t.exchange_items?.[0];
  if (!r && !e) return 'No items';
  const name = (r?.product_name || e?.product_name || '').replace(/\s*[-–—]\s*.*$/, '').split(' ').slice(0, 3).join(' ');
  const swap = r && e ? `${r.size || '—'} → ${e.size || '—'}` : r ? `return ${r.size}` : `send ${e?.size}`;
  const more = Math.max((t.return_items?.length || 0), (t.exchange_items?.length || 0)) - 1;
  return `${name} ${swap}${more > 0 ? ` · +${more}` : ''}`;
}

export default function ExchangesList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as ViewId) || 'open';
  const q = params.get('q') ?? '';
  const [reason, setReason] = useState<ReasonCode | 'all'>('all');
  const [source, setSource] = useState<RequestSource | 'all'>('all');
  const [payment, setPayment] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [sort, setSort] = useState<SortId>('sla');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { kind: 'pay' | 'delete'; tickets: Ticket[] }>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data: tickets = [], isLoading, error, refetch } = useTickets();
  const deleteTicket = useDeleteTicket();
  const { settlePayment, amountsFor, pending } = useExchangeActions();
  const { user, hasFullAccess } = useUser();
  const isAdmin = user?.role === 'ADMIN' || hasFullAccess();

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
    setPage(0);
    setSelected(new Set());
  };

  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.id, tickets.filter(v.match).length])), [tickets]);

  const rows = useMemo(() => {
    const viewDef = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
    const s = q.trim().toLowerCase();
    const now = Date.now();
    const list = tickets.filter((t) => {
      if (!viewDef.match(t)) return false;
      if (reason !== 'all' && t.reason_code !== reason) return false;
      if (source !== 'all' && t.request_source !== source) return false;
      if (payment === 'paid' && !t.is_paid) return false;
      if (payment === 'unpaid' && t.is_paid) return false;
      if (!s) return true;
      return [t.order_id, t.customer_name, t.customer_phone, t.customer_email, t.return_awb, t.exchange_awb, t.request_ref]
        .some((v) => v && String(v).toLowerCase().includes(s));
    });
    list.sort((a, b) => {
      if (sort === 'newest') return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === 'oldest') return +new Date(a.created_at) - +new Date(b.created_at);
      return slaRemaining(a, now).hours - slaRemaining(b, now).hours;
    });
    return list;
  }, [tickets, view, q, reason, source, payment, sort]);

  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const openTicket = (id: string) => navigate(`/exchanges/${id}`, { state: { ids: rows.map((r) => r.id) } });
  const selectedTickets = rows.filter((t) => selected.has(t.id));
  const allOnPage = pageRows.length > 0 && pageRows.every((t) => selected.has(t.id));
  const atRisk = tickets.filter((t) => OPEN_STATUSES.includes(getExchangeStatus(t).key) && slaRemaining(t).tone !== 'neutral').length;

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((s) => { const n = new Set(s); pageRows.forEach((t) => (allOnPage ? n.delete(t.id) : n.add(t.id))); return n; });

  const runConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.kind === 'pay') {
        for (const t of confirm.tickets) await settlePayment(t);
        toast({ title: confirm.tickets.length > 1 ? `${confirm.tickets.length} exchanges settled` : 'Payment recorded', description: 'Moved to the warehouse queue.' });
      } else {
        for (const t of confirm.tickets) await deleteTicket.mutateAsync(t.id);
        toast({ title: confirm.tickets.length > 1 ? `${confirm.tickets.length} exchanges deleted` : 'Exchange deleted' });
      }
      setSelected(new Set());
      setConfirm(null);
    } catch (e) {
      toast({ title: 'Something went wrong', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const canSettle = (t: Ticket) => ['REQUESTED', 'AWAITING_PAYMENT'].includes(getExchangeStatus(t).key);
  const activeFilters = [
    reason !== 'all' && { label: `Reason: ${REASON_LABELS[reason]}`, clear: () => setReason('all') },
    source !== 'all' && { label: `Source: ${REQUEST_SOURCE_LABELS[source]}`, clear: () => setSource('all') },
    payment !== 'all' && { label: payment === 'paid' ? 'Paid' : 'Unpaid', clear: () => setPayment('all') },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const RowMenu = ({ t }: { t: Ticket }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="More actions" onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => navigate(`/exchanges/${t.id}`)}><ExternalLink className="mr-2 size-4" />Open</DropdownMenuItem>
        {canSettle(t) && <DropdownMenuItem onClick={() => setConfirm({ kind: 'pay', tickets: [t] })}><CheckCircle2 className="mr-2 size-4" />Mark paid / settled</DropdownMenuItem>}
        {isAdmin && (<><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirm({ kind: 'delete', tickets: [t] })}><Trash2 className="mr-2 size-4" />Delete</DropdownMenuItem></>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const filterControls = (
    <>
      <Select value={reason} onValueChange={(v) => { setReason(v as ReasonCode | 'all'); setPage(0); }}>
        <SelectTrigger className="h-8 w-full sm:w-[150px] text-[13px]"><SelectValue placeholder="Reason" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any reason</SelectItem>
          {Object.entries(REASON_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={source} onValueChange={(v) => { setSource(v as RequestSource | 'all'); setPage(0); }}>
        <SelectTrigger className="h-8 w-full sm:w-[150px] text-[13px]"><SelectValue placeholder="Source" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any source</SelectItem>
          {Object.entries(REQUEST_SOURCE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={payment} onValueChange={(v) => { setPayment(v as 'all' | 'paid' | 'unpaid'); setPage(0); }}>
        <SelectTrigger className="h-8 w-full sm:w-[130px] text-[13px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any payment</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="unpaid">Unpaid</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <Layout>
      <div className="space-y-5">
        <PageHeader
          title="Exchanges"
          description={isLoading ? 'Loading…' : `${counts.open ?? 0} open · ${atRisk} at risk of SLA breach`}
          actions={
            <>
              <Button variant="secondary" onClick={() => exportTicketsToCSV(rows)} disabled={!rows.length}><Download /> Export</Button>
              <Button asChild><Link to="/exchanges/new"><Plus /> New exchange</Link></Button>
            </>
          }
        />

        <ViewTabs
          views={VIEWS.map((v) => ({ id: v.id, label: v.label, count: counts[v.id] }))}
          value={view}
          onChange={(id) => setParam('view', id === 'open' ? null : id)}
        />

        {/* Toolbar */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchField value={q} onChange={(v) => setParam('q', v || null)} placeholder="Order, name, phone, AWB…" className="w-full sm:w-72" />
            <div className="hidden lg:flex items-center gap-2">{filterControls}</div>
            <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
              <SlidersHorizontal /> Filters{activeFilters.length ? ` · ${activeFilters.length}` : ''}
            </Button>
            <div className="flex-1" />
            <Select value={sort} onValueChange={(v) => setSort(v as SortId)}>
              <SelectTrigger className="h-8 w-[150px] text-[13px]" aria-label="Sort"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sla">Sort: SLA urgency</SelectItem>
                <SelectItem value="newest">Sort: Newest</SelectItem>
                <SelectItem value="oldest">Sort: Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showFilters && <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:hidden animate-fade-in">{filterControls}</div>}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map((f) => <FilterChip key={f.label} label={f.label} onRemove={f.clear} />)}
              <button className="text-xs font-medium text-primary hover:underline" onClick={() => { setReason('all'); setSource('all'); setPayment('all'); }}>Clear all</button>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {isLoading ? (
            <RowSkeleton rows={8} />
          ) : error ? (
            <EmptyState icon={Repeat2} title="Couldn’t load exchanges" description={(error as Error).message} action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Repeat2}
              title={q || activeFilters.length ? 'No exchanges match these filters' : 'Nothing here — all caught up'}
              description={q || activeFilters.length ? 'Try a different search or clear the filters.' : 'New requests from email, WhatsApp, calls or the helpdesk show up here once lodged.'}
              action={<Button asChild><Link to="/exchanges/new"><Plus /> Lodge an exchange</Link></Button>}
            />
          ) : (
            <>
              {/* Table: tablet and up */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="w-10 py-2.5 pl-4"><Checkbox checked={allOnPage} onCheckedChange={toggleAll} aria-label="Select page" /></th>
                    <th className="py-2.5 pr-3">Order · customer</th>
                    <th className="py-2.5 pr-3">Items</th>
                    <th className="hidden xl:table-cell py-2.5 pr-3">Reason</th>
                    <th className="py-2.5 pr-3">Status</th>
                    <th className="hidden lg:table-cell py-2.5 pr-3">Payment</th>
                    <th className="py-2.5 pr-3">SLA</th>
                    <th className="hidden xl:table-cell py-2.5 pr-3">Updated</th>
                    <th className="w-12 py-2.5 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((t) => {
                    const sla = slaRemaining(t);
                    const on = selected.has(t.id);
                    return (
                      <tr
                        key={t.id}
                        onClick={() => openTicket(t.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') openTicket(t.id); }}
                        tabIndex={0}
                        className={cn('cursor-pointer border-b border-border last:border-0 transition-colors duration-100 hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none', on && 'bg-accent/60 hover:bg-accent')}
                      >
                        <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}><Checkbox checked={on} onCheckedChange={() => toggle(t.id)} aria-label={`Select ${t.order_id}`} /></td>
                        <td className="py-3 pr-3">
                          <p className="font-medium text-foreground">#{t.order_id}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[220px]">{t.customer_name} · {t.customer_phone}</p>
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground"><span className="line-clamp-1 max-w-[240px]">{itemSummary(t)}</span></td>
                        <td className="hidden xl:table-cell py-3 pr-3"><ToneBadge tone="neutral" dot={false}>{REASON_LABELS[t.reason_code] ?? t.reason_code}</ToneBadge></td>
                        <td className="py-3 pr-3"><StatusBadge ticket={t} /></td>
                        <td className="hidden lg:table-cell py-3 pr-3"><PaymentBadge ticket={t} /></td>
                        <td className="py-3 pr-3"><ToneBadge tone={sla.tone}>{sla.label}</ToneBadge></td>
                        <td className="hidden xl:table-cell py-3 pr-3 text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNowStrict(new Date(t.updated_at), { addSuffix: true })}</td>
                        <td className="py-3 pr-3 text-right" onClick={(e) => e.stopPropagation()}><RowMenu t={t} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Cards: phones */}
              <ul className="md:hidden divide-y divide-border">
                {pageRows.map((t) => {
                  const sla = slaRemaining(t);
                  return (
                    <li key={t.id} className="flex items-start gap-3 px-4 py-3.5">
                      <Checkbox className="mt-1" checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={`Select ${t.order_id}`} />
                      <Link to={`/exchanges/${t.id}`} state={{ ids: rows.map((r) => r.id) }} className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-foreground">#{t.order_id}</p>
                          <ToneBadge tone={sla.tone}>{sla.label}</ToneBadge>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{t.customer_name} · {itemSummary(t)}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5"><StatusBadge ticket={t} /><PaymentBadge ticket={t} /></div>
                      </Link>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-faint" />
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
                <span className="text-muted-foreground tabular">{page * PAGE_SIZE + 1}–{Math.min(rows.length, (page + 1) * PAGE_SIZE)} of {rows.length}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button variant="secondary" size="sm" disabled={(page + 1) * PAGE_SIZE >= rows.length} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        {selectedTickets.some(canSettle) && (
          <BulkBarButton onClick={() => setConfirm({ kind: 'pay', tickets: selectedTickets.filter(canSettle) })}><CheckCircle2 /> Mark paid</BulkBarButton>
        )}
        <BulkBarButton onClick={() => exportTicketsToCSV(selectedTickets)}><Download /> Export</BulkBarButton>
        {isAdmin && <BulkBarButton onClick={() => setConfirm({ kind: 'delete', tickets: selectedTickets })}><Trash2 /> Delete</BulkBarButton>}
      </BulkBar>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm?.kind === 'delete'}
        loading={pending || deleteTicket.isPending}
        title={confirm?.kind === 'delete'
          ? `Delete ${confirm.tickets.length > 1 ? `${confirm.tickets.length} exchanges` : `#${confirm?.tickets[0]?.order_id}`}?`
          : `Record payment for ${confirm && confirm.tickets.length > 1 ? `${confirm.tickets.length} exchanges` : `#${confirm?.tickets[0]?.order_id}`}?`}
        description={confirm?.kind === 'delete' ? 'This permanently removes the exchange and its history.' : 'They move to the warehouse queue for return pickup.'}
        confirmLabel={confirm?.kind === 'delete' ? 'Delete' : 'Record payment'}
        onConfirm={runConfirm}
      >
        {confirm?.kind === 'pay' && confirm.tickets.length <= 5 && (
          <ul className="space-y-1.5 rounded-lg bg-muted/60 p-3 text-sm">
            {confirm.tickets.map((t) => {
              const a = amountsFor(t);
              return (
                <li key={t.id} className="flex justify-between gap-3">
                  <span className="truncate">#{t.order_id} · {t.customer_name}</span>
                  <span className="font-medium tabular">{a.net >= 0 ? `Collect ${formatINR(a.net)}` : `Refund ${formatINR(-a.net)}`}</span>
                </li>
              );
            })}
          </ul>
        )}
      </ConfirmDialog>
    </Layout>
  );
}
