import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Archive,
  Check,
  CircleCheckBig,
  Download,
  ExternalLink,
  ReceiptText,
  SearchX,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import Layout from '@/components/Layout';
import {
  BulkBar,
  BulkBarButton,
  EmptyState,
  KpiCard,
  PageHeader,
  SearchField,
  ViewTabs,
  formatINR,
} from '@/components/app';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTickets, useUpdateTicket } from '@/hooks/useTickets';
import { useProductPrices } from '@/hooks/useProductPrices';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Ticket } from '@/types/database';
import { FinanceList } from './FinanceList';
import {
  ACTIVE_FINANCE_STAGES,
  PROCESSING_STORAGE_KEY,
  ZOHO_SALES_ORDERS_URL,
  downloadFinanceCSV,
  financeTabOf,
  inThisMonth,
  itemsValue,
  matchesSearch,
  refundAgeDays,
  shippedAt,
  type FinanceTab,
} from './financeUtils';

type ActionKind = 'invoice' | 'refund' | 'close';

const TAB_IDS: FinanceTab[] = ['to-invoice', 'refunds', 'invoiced', 'completed'];
const TAB_LABELS: Record<FinanceTab, string> = {
  'to-invoice': 'To invoice',
  refunds: 'Refunds due',
  invoiced: 'Invoiced',
  completed: 'Completed',
};

const EMPTY: Record<FinanceTab, { icon: React.ElementType; title: string; description: string }> = {
  'to-invoice': {
    icon: ReceiptText,
    title: 'Nothing to invoice — all caught up',
    description: 'Exchanges show up here once the replacement has been booked or shipped.',
  },
  refunds: {
    icon: Wallet,
    title: 'No refunds due',
    description: 'Invoiced exchanges that owe the customer money appear here until the refund is sent.',
  },
  invoiced: {
    icon: CircleCheckBig,
    title: 'Nothing waiting to close',
    description: 'Invoiced exchanges with no refund owed land here, ready to be closed.',
  },
  completed: {
    icon: Archive,
    title: 'No completed exchanges yet',
    description: 'Closed and refunded exchanges are listed here for reference.',
  },
};

const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

function readProcessing(): Set<string> {
  try {
    const raw = sessionStorage.getItem(PROCESSING_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeProcessing(s: Set<string>) {
  try {
    sessionStorage.setItem(PROCESSING_STORAGE_KEY, JSON.stringify(Array.from(s)));
  } catch {
    /* storage unavailable: the two-step state just won't survive a reload */
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function Finance() {
  const { toast } = useToast();
  const updateTicket = useUpdateTicket();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as FinanceTab | null;
  const tab: FinanceTab = tabParam && TAB_IDS.includes(tabParam) ? tabParam : 'to-invoice';

  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<Set<string>>(new Set());
  const [processing, setProcessing] = React.useState<Set<string>>(readProcessing);
  const [confirm, setConfirm] = React.useState<{ kind: ActionKind; ids: string[] } | null>(null);
  const [confirmRunning, setConfirmRunning] = React.useState(false);

  // Active finance work is fetched on its own (small, never truncated); the
  // unfiltered query is shared with Layout and covers closed tickets + month KPIs.
  const activeQuery = useTickets({ stage: ACTIVE_FINANCE_STAGES });
  const allQuery = useTickets();
  const { data: prices } = useProductPrices();

  const tickets = React.useMemo(() => {
    const byId = new Map<string, Ticket>();
    for (const t of allQuery.data ?? []) byId.set(t.id, t);
    for (const t of activeQuery.data ?? []) byId.set(t.id, t);
    return Array.from(byId.values());
  }, [allQuery.data, activeQuery.data]);

  const values = React.useMemo(() => {
    const m = new Map<string, number | null>();
    for (const t of tickets) m.set(t.id, itemsValue(t.exchange_items, prices));
    return m;
  }, [tickets, prices]);
  const valueOf = React.useCallback((t: Ticket) => values.get(t.id) ?? null, [values]);

  /* ---------------- partition into tabs ---------------- */

  const byTab = React.useMemo(() => {
    const groups: Record<FinanceTab, Ticket[]> = { 'to-invoice': [], refunds: [], invoiced: [], completed: [] };
    for (const t of tickets) {
      const k = financeTabOf(t);
      if (k) groups[k].push(t);
    }
    // Oldest work first; history newest first.
    groups['to-invoice'].sort((a, b) => ts(shippedAt(a) ?? a.created_at) - ts(shippedAt(b) ?? b.created_at));
    groups.invoiced.sort((a, b) => ts(a.invoicing_done_at ?? a.updated_at) - ts(b.invoicing_done_at ?? b.updated_at));
    groups.refunds.sort((a, b) => refundAgeDays(b) - refundAgeDays(a));
    groups.completed.sort(
      (a, b) => ts(b.closed_at ?? b.refund_sent_at ?? b.updated_at) - ts(a.closed_at ?? a.refund_sent_at ?? a.updated_at),
    );
    return groups;
  }, [tickets]);

  const filtered = React.useMemo(() => {
    const out = {} as Record<FinanceTab, Ticket[]>;
    for (const id of TAB_IDS) out[id] = byTab[id].filter((t) => matchesSearch(t, search));
    return out;
  }, [byTab, search]);

  const rows = filtered[tab];

  /* ---------------- KPIs ---------------- */

  const kpis = React.useMemo(() => {
    const now = new Date();
    const toInvoiceValue = byTab['to-invoice'].reduce((s, t) => s + (valueOf(t) ?? 0), 0);
    const refundsValue = byTab.refunds.reduce((s, t) => s + (t.refund_amount || 0), 0);
    const oldestRefund = byTab.refunds.reduce((m, t) => Math.max(m, refundAgeDays(t, now)), 0);
    const collected = tickets.filter((t) => inThisMonth(t.exchange_completed_at, now) && (t.amount_collected || 0) > 0);
    const refunded = tickets.filter((t) => inThisMonth(t.refund_sent_at, now) && (t.refund_amount || 0) > 0);
    return {
      toInvoiceValue,
      refundsValue,
      oldestRefund,
      collectedSum: collected.reduce((s, t) => s + t.amount_collected, 0),
      collectedCount: collected.length,
      refundedSum: refunded.reduce((s, t) => s + t.refund_amount, 0),
      refundedCount: refunded.length,
    };
  }, [byTab, tickets, valueOf]);

  /* ---------------- selection ---------------- */

  // Only rows still in the current view count (tickets move tabs after an action).
  const selectedRows = React.useMemo(() => rows.filter((t) => selected.has(t.id)), [rows, selected]);
  const selectedTotal = selectedRows.reduce(
    (s, t) => s + (tab === 'refunds' ? t.refund_amount || 0 : valueOf(t) ?? 0),
    0,
  );

  const changeTab = (next: FinanceTab) => {
    setSelected(new Set());
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (next === 'to-invoice') n.delete('tab');
      else n.set('tab', next);
      return n;
    }, { replace: true });
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });

  /* ---------------- actions ---------------- */

  const updateProcessing = (fn: (s: Set<string>) => void) =>
    setProcessing((prev) => {
      const n = new Set(prev);
      fn(n);
      writeProcessing(n);
      return n;
    });

  const openZoho = (id: string) => {
    updateProcessing((s) => s.add(id));
    window.open(ZOHO_SALES_ORDERS_URL, '_blank', 'noopener,noreferrer');
  };

  // Same fields and events as the old Invoicing page, so existing data stays compatible.
  const perform = (kind: ActionKind, id: string) => {
    const now = new Date().toISOString();
    if (kind === 'invoice') {
      return updateTicket.mutateAsync({ id, stage: 'INVOICED', status: 'COMPLETED', invoicing_done_at: now, eventType: 'INVOICED' });
    }
    if (kind === 'refund') {
      return updateTicket.mutateAsync({
        id,
        stage: 'CLOSED',
        status: 'COMPLETED',
        refund_sent_at: now,
        refund_status: 'PROCESSED',
        closed_at: now,
        eventType: 'REFUND_SENT',
      });
    }
    return updateTicket.mutateAsync({
      id,
      stage: 'CLOSED',
      status: 'COMPLETED',
      refund_status: 'PROCESSED',
      closed_at: now,
      eventType: 'CLOSED',
    });
  };

  const runAction = async (kind: ActionKind, ids: string[]) => {
    if (ids.length === 0) return;
    const refundTotal = ids.reduce((s, id) => s + (tickets.find((t) => t.id === id)?.refund_amount || 0), 0);
    setBusy((prev) => new Set([...prev, ...ids]));
    const results = await Promise.allSettled(ids.map((id) => perform(kind, id)));
    const done = ids.filter((_, i) => results[i].status === 'fulfilled');
    const firstError = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    setBusy((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.delete(id));
      return n;
    });
    if (done.length) {
      setSelected((prev) => {
        const n = new Set(prev);
        done.forEach((id) => n.delete(id));
        return n;
      });
      if (kind === 'invoice') updateProcessing((s) => done.forEach((id) => s.delete(id)));
      const title =
        kind === 'invoice'
          ? `${plural(done.length, 'exchange')} marked invoiced`
          : kind === 'refund'
            ? `${plural(done.length, 'refund')} marked sent`
            : `${plural(done.length, 'exchange')} closed`;
      const description =
        kind === 'invoice'
          ? 'Moved to Invoiced, or Refunds due where a refund is owed.'
          : kind === 'refund'
            ? `${formatINR(refundTotal)} refunded. Tickets are now closed.`
            : 'Moved to Completed.';
      toast({ title, description });
    }
    if (firstError) {
      const failed = ids.length - done.length;
      const reason = firstError.reason instanceof Error ? firstError.reason.message : String(firstError.reason ?? '');
      toast({
        variant: 'destructive',
        title: `${plural(failed, 'exchange')} couldn't be updated`,
        description: reason || 'Please try again.',
      });
    }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    setConfirmRunning(true);
    try {
      await runAction(confirm.kind, confirm.ids);
    } finally {
      setConfirmRunning(false);
      setConfirm(null);
    }
  };

  const exportRows = (list: Ticket[], scope: string) => {
    if (list.length === 0) return;
    downloadFinanceCSV(list, prices, `kotu-finance-${scope}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    toast({ title: `Exported ${plural(list.length, 'row')}`, description: 'CSV ready to import into Zoho Books.' });
  };

  /* ---------------- render helpers ---------------- */

  const renderAction = (t: Ticket, { phone }: { phone: boolean }) => {
    const size = phone ? 'default' : 'sm';
    const isBusy = busy.has(t.id);
    switch (tab) {
      case 'to-invoice':
        if (processing.has(t.id)) {
          return (
            <>
              <Button
                variant="ghost"
                size={phone ? 'icon' : 'icon-sm'}
                onClick={() => openZoho(t.id)}
                aria-label="Open Zoho Books again"
                title="Open Zoho Books again"
              >
                <ExternalLink />
              </Button>
              <Button variant="secondary" size={size} disabled={isBusy} onClick={() => runAction('invoice', [t.id])}>
                <Check />
                Mark invoiced
              </Button>
            </>
          );
        }
        return (
          <Button variant="secondary" size={size} disabled={isBusy} onClick={() => openZoho(t.id)}>
            <ExternalLink />
            Invoice in Zoho
          </Button>
        );
      case 'refunds':
        return (
          <Button variant="secondary" size={size} disabled={isBusy} onClick={() => setConfirm({ kind: 'refund', ids: [t.id] })}>
            Mark refunded
          </Button>
        );
      case 'invoiced':
        return (
          <Button variant="secondary" size={size} disabled={isBusy} onClick={() => runAction('close', [t.id])}>
            Close
          </Button>
        );
      default:
        return null;
    }
  };

  const query = tab === 'completed' ? allQuery : activeQuery;
  const isLoading = query.isLoading;
  const empty = EMPTY[tab];
  const placeholder = query.error ? (
    <EmptyState
      icon={TriangleAlert}
      title="Couldn't load the finance queue"
      description={query.error instanceof Error ? query.error.message : 'Something went wrong.'}
      action={<Button variant="secondary" onClick={() => query.refetch()}>Try again</Button>}
    />
  ) : rows.length === 0 ? (
    search.trim() ? (
      <EmptyState
        icon={SearchX}
        title={`No matches for “${search.trim()}”`}
        description="Try an order ID, customer name or phone number."
        action={<Button variant="secondary" onClick={() => setSearch('')}>Clear search</Button>}
      />
    ) : (
      <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
    )
  ) : null;

  // Keep the last request rendered while the dialog animates closed.
  const lastConfirm = React.useRef(confirm);
  if (confirm) lastConfirm.current = confirm;
  const shownConfirm = confirm ?? lastConfirm.current;
  const confirmIds = shownConfirm?.ids ?? [];
  const confirmTickets = tickets.filter((t) => confirmIds.includes(t.id));
  const confirmRefundTotal = confirmTickets.reduce((s, t) => s + (t.refund_amount || 0), 0);
  const confirmCopy: Record<ActionKind, { title: string; description: string; cta: string }> = {
    invoice: {
      title: `Mark ${plural(confirmIds.length, 'exchange')} as invoiced?`,
      description:
        'Only confirm once the invoices exist in Zoho Books. Exchanges that owe a refund move to Refunds due; the rest move to Invoiced.',
      cta: 'Mark invoiced',
    },
    refund: {
      title:
        confirmIds.length === 1
          ? `Mark refund of ${formatINR(confirmRefundTotal)} as sent?`
          : `Mark ${confirmIds.length} refunds (${formatINR(confirmRefundTotal)}) as sent?`,
      description:
        confirmIds.length === 1 && confirmTickets[0]
          ? `#${confirmTickets[0].order_id} · ${confirmTickets[0].customer_name}. The exchange will be closed.`
          : 'Each exchange will be recorded as refunded and closed.',
      cta: 'Mark refunded',
    },
    close: {
      title: `Close ${plural(confirmIds.length, 'exchange')}?`,
      description: 'They move to Completed. No refund is owed on these exchanges.',
      cta: 'Close',
    },
  };

  return (
    <Layout>
      <div className={cn('space-y-5 animate-fade-in', selectedRows.length > 0 && 'pb-20')}>
        <PageHeader
          title="Finance"
          description="Invoice completed exchanges and close out refunds"
          actions={
            <Button variant="secondary" onClick={() => exportRows(rows, tab)} disabled={rows.length === 0}>
              <Download />
              Export for Zoho
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <KpiCard
            label="To invoice"
            value={byTab['to-invoice'].length}
            meta={`${formatINR(kpis.toInvoiceValue)} in exchange value`}
            loading={activeQuery.isLoading}
            onClick={() => changeTab('to-invoice')}
            active={tab === 'to-invoice'}
          />
          <KpiCard
            label="Refunds due"
            value={byTab.refunds.length}
            meta={
              byTab.refunds.length
                ? `${formatINR(kpis.refundsValue)} · oldest ${plural(kpis.oldestRefund, 'day')}`
                : 'Nothing owed'
            }
            tone={byTab.refunds.length ? 'warning' : undefined}
            loading={activeQuery.isLoading}
            onClick={() => changeTab('refunds')}
            active={tab === 'refunds'}
          />
          <KpiCard
            label="Collected this month"
            value={formatINR(kpis.collectedSum)}
            meta={plural(kpis.collectedCount, 'payment')}
            loading={allQuery.isLoading}
          />
          <KpiCard
            label="Refunded this month"
            value={formatINR(kpis.refundedSum)}
            meta={plural(kpis.refundedCount, 'refund')}
            loading={allQuery.isLoading}
          />
        </div>

        <div className="space-y-3">
          <ViewTabs
            views={TAB_IDS.map((id) => ({ id, label: TAB_LABELS[id], count: filtered[id].length }))}
            value={tab}
            onChange={changeTab}
          />
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search order ID, name or phone"
            className="sm:max-w-xs"
          />
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <FinanceList
            key={`${tab}:${search}`}
            tab={tab}
            rows={rows}
            isLoading={isLoading}
            placeholder={placeholder}
            selected={selected}
            onToggle={toggle}
            onToggleMany={toggleMany}
            valueOf={valueOf}
            renderAction={renderAction}
          />
        </section>
      </div>

      <BulkBar count={selectedRows.length} summary={formatINR(selectedTotal)} onClear={() => setSelected(new Set())}>
        {tab === 'to-invoice' && (
          <BulkBarButton onClick={() => setConfirm({ kind: 'invoice', ids: selectedRows.map((t) => t.id) })}>
            <Check />
            Mark invoiced
          </BulkBarButton>
        )}
        {tab === 'refunds' && (
          <BulkBarButton onClick={() => setConfirm({ kind: 'refund', ids: selectedRows.map((t) => t.id) })}>
            <Wallet />
            Mark refunded
          </BulkBarButton>
        )}
        {tab === 'invoiced' && (
          <BulkBarButton onClick={() => setConfirm({ kind: 'close', ids: selectedRows.map((t) => t.id) })}>
            <CircleCheckBig />
            Close
          </BulkBarButton>
        )}
        <BulkBarButton onClick={() => exportRows(selectedRows, `${tab}-selected`)}>
          <Download />
          Export selected
        </BulkBarButton>
      </BulkBar>

      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o && !confirmRunning) setConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          {shownConfirm && (
            <>
              <DialogHeader>
                <DialogTitle>{confirmCopy[shownConfirm.kind].title}</DialogTitle>
                <DialogDescription>{confirmCopy[shownConfirm.kind].description}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setConfirm(null)} disabled={confirmRunning}>
                  Cancel
                </Button>
                <Button onClick={confirmAction} disabled={confirmRunning}>
                  {confirmRunning ? 'Updating…' : confirmCopy[shownConfirm.kind].cta}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
