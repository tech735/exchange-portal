import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, RefreshCw, ShoppingBag } from 'lucide-react';
import Layout from '@/components/Layout';
import { shopifyService } from '@/services/shopify';
import { useAppSettings } from '@/hooks/useAppData';
import { useToast } from '@/hooks/use-toast';
import { exportOrdersToCSV } from '@/utils/exportUtils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BulkBar,
  BulkBarButton,
  EmptyState,
  FilterChip,
  PageHeader,
  RowSkeleton,
  SearchField,
  ToneBadge,
} from '@/components/app';
import { OrderPanel } from './OrderPanel';
import {
  customerEmail,
  customerName,
  eligibility,
  fulfillmentPill,
  itemCount,
  matchesSearch,
  money,
  orderNumber,
  paymentPill,
  relativeTime,
  type OrderRecord,
} from './orderUtils';

const PAYMENT_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'partially_refunded', label: 'Partially refunded' },
  { value: 'voided', label: 'Voided' },
];

const FULFILLMENT_OPTIONS = [
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'partial', label: 'Partial' },
  { value: 'unfulfilled', label: 'Unfulfilled' },
];

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * True at Tailwind's `xl` breakpoint and up. The split view needs ~1280px: at `lg` the 240px sidebar
 * plus a 420px panel would leave the table under 300px wide, so tablets/small laptops get the Sheet.
 */
function useIsWide() {
  const query = '(min-width: 1280px)';
  const [isWide, setIsWide] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : true));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsWide(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isWide;
}

/** Re-renders periodically so relative times ("2 min ago", "Nd left") stay fresh. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function Orders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isWide = useIsWide();
  const now = useNow();

  const { data: settings } = useAppSettings();
  const windowDays = settings?.exchange_policy?.window_days ?? 10;

  const ordersQuery = useQuery({
    queryKey: ['shopify', 'recent-orders'],
    queryFn: async () => (await shopifyService.getRecentOrders()) as OrderRecord[],
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const { isLoading, isFetching, isError, error, dataUpdatedAt } = ordersQuery;

  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);

  const syncNow = async () => {
    const res = await ordersQuery.refetch();
    if (res.error) {
      toast({
        title: 'Sync failed',
        description: (res.error as Error).message || 'Failed to sync with Shopify',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Orders synced', description: `${res.data?.length ?? 0} recent orders loaded from Shopify.` });
    }
  };

  const filteredOrders = useMemo(
    () =>
      orders.filter((o) => {
        if (!matchesSearch(o, searchQuery)) return false;
        if (paymentFilter !== 'all' && o.financial_status?.toLowerCase() !== paymentFilter) return false;
        if (fulfillmentFilter !== 'all') {
          if (fulfillmentFilter === 'unfulfilled') return !o.fulfillment_status;
          return o.fulfillment_status?.toLowerCase() === fulfillmentFilter;
        }
        return true;
      }),
    [orders, searchQuery, paymentFilter, fulfillmentFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, paymentFilter, fulfillmentFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const activeOrder = useMemo(() => orders.find((o) => o.id === activeId) ?? null, [orders, activeId]);

  /* ---------------- selection ---------------- */
  const allOnPageSelected = paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedIds.has(o.id));
  const someOnPageSelected = paginatedOrders.some((o) => selectedIds.has(o.id));

  const toggleAllOnPage = (checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      paginatedOrders.forEach((o) => (checked ? next.add(o.id) : next.delete(o.id)));
      return next;
    });

  const toggleOne = (id: number, checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const exportSelected = () => {
    const selected = filteredOrders.filter((o) => selectedIds.has(o.id));
    exportOrdersToCSV(selected as Parameters<typeof exportOrdersToCSV>[0]);
  };

  const selectedTotal = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)).reduce((s, o) => s + Number(o.total_price || 0), 0),
    [orders, selectedIds],
  );

  const startExchange = (o: OrderRecord) => navigate(`/exchanges/new?order=${encodeURIComponent(orderNumber(o))}`);

  const hasFilters = !!searchQuery || paymentFilter !== 'all' || fulfillmentFilter !== 'all';
  const clearFilters = () => {
    setSearchQuery('');
    setPaymentFilter('all');
    setFulfillmentFilter('all');
  };

  const showSplit = isWide && !!activeOrder;
  // In split view the table is ~520–700px wide, so low-priority columns drop out sooner.
  const dateCol = showSplit ? 'hidden min-[1400px]:table-cell' : 'hidden lg:table-cell';
  const paymentCol = showSplit ? 'hidden' : 'hidden lg:table-cell';

  /* ---------------- states ---------------- */
  const listBody = (renderRows: () => React.ReactNode) => {
    if (isLoading) return <RowSkeleton rows={8} />;
    if (isError && orders.length === 0) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load orders"
          description={(error as Error)?.message || 'Failed to sync with Shopify.'}
          action={
            <Button variant="secondary" onClick={() => ordersQuery.refetch()} disabled={isFetching}>
              <RefreshCw className={cn(isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      );
    }
    if (orders.length === 0) {
      return <EmptyState icon={ShoppingBag} title="No orders yet" description="Recent Shopify orders will appear here once customers start ordering." />;
    }
    if (filteredOrders.length === 0) {
      return (
        <EmptyState
          icon={ShoppingBag}
          title="No matching orders"
          description={searchQuery ? `Nothing matches "${searchQuery}" with the current filters.` : 'No orders match the current filters.'}
          action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
        />
      );
    }
    return renderRows();
  };

  const pagination = filteredOrders.length > 0 && !isLoading && (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground tabular">
        {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
      </p>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows</span>
          <Select
            value={String(itemsPerPage)}
            onValueChange={(v) => {
              setItemsPerPage(Number(v));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[72px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <span className="min-w-[64px] text-center text-xs text-muted-foreground tabular">
            {currentPage} / {totalPages}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );

  const paymentLabel = PAYMENT_OPTIONS.find((o) => o.value === paymentFilter)?.label;
  const fulfillmentLabel = FULFILLMENT_OPTIONS.find((o) => o.value === fulfillmentFilter)?.label;

  return (
    <Layout>
      <div className="space-y-5 animate-fade-in">
        <PageHeader
          title="Orders"
          description={
            isLoading && !dataUpdatedAt ? 'Syncing from Shopify…' : `Synced from Shopify · ${relativeTime(dataUpdatedAt, now)}`
          }
          actions={
            <Button variant="secondary" onClick={syncNow} disabled={isFetching}>
              <RefreshCw className={cn(isFetching && 'animate-spin')} />
              Sync now
            </Button>
          }
        />

        {/* Toolbar */}
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Order no., name, phone, email…"
              className="w-full sm:w-72"
            />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="sm:w-[168px]" aria-label="Payment status">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  {PAYMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
                <SelectTrigger className="sm:w-[168px]" aria-label="Fulfillment status">
                  <SelectValue placeholder="Fulfillment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All fulfillment</SelectItem>
                  {FULFILLMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(paymentFilter !== 'all' || fulfillmentFilter !== 'all') && (
            <div className="flex flex-wrap items-center gap-2">
              {paymentFilter !== 'all' && <FilterChip label={`Payment: ${paymentLabel}`} onRemove={() => setPaymentFilter('all')} />}
              {fulfillmentFilter !== 'all' && <FilterChip label={`Fulfillment: ${fulfillmentLabel}`} onRemove={() => setFulfillmentFilter('all')} />}
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* List + panel */}
        <div className={cn('grid items-start gap-5', showSplit && 'xl:grid-cols-[minmax(0,1fr)_420px]')}>
          {/* Phones: stacked cards */}
          <div className="overflow-hidden rounded-xl border border-border bg-card md:hidden">
            {listBody(() => (
              <ul className="divide-y divide-border">
                {paginatedOrders.map((order) => {
                  const pay = paymentPill(order);
                  const ful = fulfillmentPill(order);
                  const elig = eligibility(order, windowDays, new Date(now));
                  const checked = selectedIds.has(order.id);
                  return (
                    <li key={order.id} className={cn('flex items-start gap-3 px-4 py-3 transition-colors', checked && 'bg-accent')}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => toggleOne(order.id, c === true)}
                        aria-label={`Select order ${orderNumber(order)}`}
                        className="mt-1"
                      />
                      <button
                        type="button"
                        onClick={() => setActiveId(order.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">{orderNumber(order)}</span>
                            <span className="shrink-0 text-sm font-medium tabular text-foreground">{money(order.total_price, order.currency)}</span>
                          </div>
                          <p className="truncate text-[13px] text-muted-foreground">
                            {customerName(order)} · {itemCount(order)} {itemCount(order) === 1 ? 'item' : 'items'} · {format(new Date(order.created_at), 'd MMM')}
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            <ToneBadge tone={pay.tone}>{pay.label}</ToneBadge>
                            <ToneBadge tone={ful.tone}>{ful.label}</ToneBadge>
                            <ToneBadge tone={elig.tone}>{elig.label}</ToneBadge>
                          </div>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ))}
            {pagination}
          </div>

          {/* Tablet / desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            {listBody(() => (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                        onCheckedChange={(c) => toggleAllOnPage(c === true)}
                        aria-label="Select all orders on this page"
                      />
                    </TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className={dateCol}>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className={paymentCol}>Payment</TableHead>
                    <TableHead>Fulfillment</TableHead>
                    <TableHead>Exchange</TableHead>
                    {!showSplit && <TableHead className="hidden xl:table-cell w-[1%]"><span className="sr-only">Actions</span></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => {
                    const pay = paymentPill(order);
                    const ful = fulfillmentPill(order);
                    const elig = eligibility(order, windowDays, new Date(now));
                    const checked = selectedIds.has(order.id);
                    const active = order.id === activeId;
                    const email = customerEmail(order);
                    return (
                      <TableRow
                        key={order.id}
                        data-state={checked || active ? 'selected' : undefined}
                        aria-selected={active}
                        tabIndex={0}
                        onClick={() => setActiveId(order.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setActiveId(order.id);
                          }
                        }}
                        className={cn('group cursor-pointer focus-visible:outline-none focus-visible:bg-muted/60', active && 'bg-accent hover:bg-accent')}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => toggleOne(order.id, c === true)}
                            aria-label={`Select order ${orderNumber(order)}`}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-foreground">{orderNumber(order)}</TableCell>
                        <TableCell className={cn('whitespace-nowrap text-muted-foreground', dateCol)}>
                          {format(new Date(order.created_at), 'd MMM')}
                        </TableCell>
                        <TableCell className={cn(showSplit ? 'max-w-[160px]' : 'max-w-[220px]')}>
                          <div className="truncate font-medium text-foreground">{customerName(order)}</div>
                          {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-medium tabular">{money(order.total_price, order.currency)}</TableCell>
                        <TableCell className={paymentCol}>
                          <ToneBadge tone={pay.tone}>{pay.label}</ToneBadge>
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={ful.tone}>{ful.label}</ToneBadge>
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={elig.tone}>{elig.label}</ToneBadge>
                        </TableCell>
                        {!showSplit && (
                          <TableCell className="hidden py-0 text-right xl:table-cell" onClick={(e) => e.stopPropagation()}>
                            {elig.eligible && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startExchange(order)}
                                className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                              >
                                Exchange
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ))}
            {pagination}
          </div>

          {/* xl+: order panel beside the table */}
          {showSplit && activeOrder && (
            <aside className="hidden rounded-xl border border-border bg-card p-5 animate-fade-in xl:sticky xl:top-20 xl:block xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
              <OrderPanel key={activeOrder.id} order={activeOrder} windowDays={windowDays} onClose={() => setActiveId(null)} />
            </aside>
          )}
        </div>
      </div>

      {/* Below xl: order panel in a sheet */}
      <Sheet open={!isWide && !!activeOrder} onOpenChange={(open) => !open && setActiveId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-card p-5 sm:max-w-[440px]" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Order {activeOrder ? orderNumber(activeOrder) : ""}</SheetTitle>
          {activeOrder && <OrderPanel order={activeOrder} windowDays={windowDays} onClose={() => setActiveId(null)} showClose={false} />}
        </SheetContent>
      </Sheet>

      <BulkBar count={selectedIds.size} onClear={clearSelection} summary={money(selectedTotal)}>
        <BulkBarButton onClick={exportSelected}>
          <Download />
          Export CSV
        </BulkBarButton>
      </BulkBar>
    </Layout>
  );
}
