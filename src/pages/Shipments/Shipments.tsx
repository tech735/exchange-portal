import { useEffect, useMemo, useRef, useState } from 'react';
import { differenceInMinutes, formatDistanceToNow, parseISO, subDays } from 'date-fns';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  PackageCheck,
  PackageSearch,
  PackageX,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Truck,
  Upload,
} from 'lucide-react';
import Layout from '@/components/Layout';
import { KPICard } from '@/pages/Dashboard/KPICard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import {
  useCreateShipment,
  useDeleteShipment,
  useShipmentSettings,
  useShipments,
  useSpecialCases,
  useSyncShipments,
  useUpdateShipment,
  type ShipmentPatch,
} from '@/hooks/useShipments';
import {
  DEFAULT_SHIPMENT_SETTINGS,
  DELIVERY_CHECK_LABELS,
  dailyReport,
  dailySummary,
  formatDay,
  istNow,
  summarizeShipments,
  toDateInput,
  trackShipments,
  type DeliveryCheck,
  type TrackedShipment,
} from '@/lib/shipmentTracking';
import { exportShipmentsToExcel } from '@/utils/exportUtils';
import {
  DELIVERY_ZONE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  SHIPMENT_STATUS_LABELS,
  type DeliveryZone,
  type ShipmentStatus,
} from '@/types/database';
import { cn } from '@/lib/utils';
import { DeliveryCheckBadge } from './DeliveryCheckBadge';
import { ShipmentForm } from './ShipmentForm';
import { ShipmentSettingsDialog } from './ShipmentSettingsDialog';
import { ImportTrackerDialog } from './ImportTrackerDialog';
import { DailyReport } from './DailyReport';
import { SpecialCases } from './SpecialCases';

type CheckFilter = 'all' | 'needs_action' | 'open' | 'delivered' | DeliveryCheck;

// Most urgent first, so nothing that needs a call or a courier chase is
// below the fold.
const CHECK_PRIORITY: Record<DeliveryCheck, number> = {
  ESCALATED: 0,
  DELAYED_NOTIFY: 1,
  PICKUP_DELAYED: 2,
  DELAYED_NOTIFIED: 3,
  AWAITING_PICKUP: 4,
  ON_TRACK: 5,
  RTO: 6,
  DELIVERED_LATE: 7,
  DELIVERED_ON_TIME: 7,
  CANCELLED: 8,
};

const OPEN_CHECKS: DeliveryCheck[] = ['ESCALATED', 'DELAYED_NOTIFY', 'PICKUP_DELAYED', 'DELAYED_NOTIFIED', 'AWAITING_PICKUP', 'ON_TRACK'];

// Re-pull from Shopify on open when the last sync is older than this.
const AUTO_SYNC_AFTER_MINUTES = 30;

function matchesCheck(s: TrackedShipment, filter: CheckFilter) {
  if (filter === 'all') return true;
  if (filter === 'needs_action') return s.needsAction;
  if (filter === 'open') return OPEN_CHECKS.includes(s.check);
  if (filter === 'delivered') return s.check === 'DELIVERED_ON_TIME' || s.check === 'DELIVERED_LATE';
  return s.check === filter;
}

function AwbLink({ shipment }: { shipment: TrackedShipment }) {
  if (!shipment.awb_number) return <span className="text-muted-foreground">—</span>;
  if (!shipment.tracking_url) return <span>{shipment.awb_number}</span>;
  return (
    <a
      href={shipment.tracking_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-primary hover:underline"
    >
      {shipment.awb_number}
    </a>
  );
}

// Quick status change from the row itself, for when the courier's tracking
// hasn't reached Shopify. Clicks are stopped by the parent cell so the row
// doesn't open the edit panel.
function StatusSelect({
  shipment,
  onChange,
  disabled,
}: {
  shipment: TrackedShipment;
  onChange: (status: ShipmentStatus) => void;
  disabled: boolean;
}) {
  return (
    <Select value={shipment.status} onValueChange={(v) => onChange(v as ShipmentStatus)} disabled={disabled}>
      <SelectTrigger className="h-8 w-[150px] text-xs" aria-label={`Status of ${shipment.shipment_ref}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(SHIPMENT_STATUS_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const delayLabel = (s: TrackedShipment) =>
  s.daysDelayed === null ? '—' : s.daysDelayed === 0 ? 'today' : String(s.daysDelayed);

export default function Shipments() {
  const { toast } = useToast();
  const { user, hasFullAccess } = useUser();
  const isAdmin = hasFullAccess() || user?.role === 'ADMIN';

  const [lookbackDays, setLookbackDays] = useState<number | null>(30);
  const { data: shipments = [], isLoading } = useShipments(lookbackDays);
  const { data: settings = DEFAULT_SHIPMENT_SETTINGS } = useShipmentSettings();
  const syncShipments = useSyncShipments();
  const updateShipment = useUpdateShipment();
  const createShipment = useCreateShipment();
  const deleteShipment = useDeleteShipment();

  const [searchQuery, setSearchQuery] = useState('');
  const [checkFilter, setCheckFilter] = useState<CheckFilter>('open');
  const [zoneFilter, setZoneFilter] = useState<'all' | DeliveryZone>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Checks depend on the clock (the pickup deadline is 1 PM), so re-evaluate
  // every minute while the page is open.
  const [now, setNow] = useState(istNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(istNow()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  const clockKey = `${now.date}:${now.hour}`;

  const tracked = useMemo(
    () =>
      trackShipments(shipments, settings, now).sort(
        (a, b) =>
          CHECK_PRIORITY[a.check] - CHECK_PRIORITY[b.check] ||
          b.order_date.localeCompare(a.order_date) ||
          // Same day: newest order number first, then an order's parcels as -F1, -F2 …
          b.order_name.localeCompare(a.order_name, undefined, { numeric: true }) ||
          a.shipment_ref.localeCompare(b.shipment_ref, undefined, { numeric: true })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` matters only per hour
    [shipments, settings, clockKey]
  );

  const stats = useMemo(() => summarizeShipments(tracked, now.date), [tracked, now.date]);
  const summary = dailySummary(stats, now.date);
  const reportSince = lookbackDays === null ? null : toDateInput(subDays(new Date(), lookbackDays));
  const report = useMemo(() => dailyReport(tracked, reportSince), [tracked, reportSince]);
  const rtoShipments = useMemo(() => tracked.filter((s) => s.check === 'RTO'), [tracked]);
  const { data: specialCases = [] } = useSpecialCases();
  const openSpecialCount =
    rtoShipments.filter((s) => !s.resolved_on).length + specialCases.filter((c) => c.status === 'OPEN').length;

  const lastSyncedAt = useMemo(() => {
    const times = shipments.map((s) => s.last_synced_at).filter(Boolean) as string[];
    return times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
  }, [shipments]);

  const runSync = (silent = false) =>
    syncShipments.mutate(undefined, {
      onSuccess: (result) => {
        if (!silent) {
          toast({
            title: 'Shipments synced',
            description: `${result.ordersScanned} Shopify orders checked · ${result.created} new · ${result.updated} updated`,
          });
        }
      },
      onError: (error: Error) =>
        toast({ title: 'Shopify sync failed', description: error.message, variant: 'destructive' }),
    });

  // Keep the tracker fresh without waiting for the hourly job.
  const autoSynced = useRef(false);
  useEffect(() => {
    if (isLoading || autoSynced.current) return;
    autoSynced.current = true;
    if (!lastSyncedAt || differenceInMinutes(new Date(), parseISO(lastSyncedAt)) > AUTO_SYNC_AFTER_MINUTES) {
      runSync(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, lastSyncedAt]);

  const filtered = tracked.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      [s.shipment_ref, s.customer_name, s.customer_phone, s.customer_email, s.city, s.awb_number]
        .some((v) => v?.toLowerCase().includes(q));
    const matchesZone = zoneFilter === 'all' || s.delivery_zone === zoneFilter;
    return matchesSearch && matchesZone && matchesCheck(s, checkFilter);
  });

  useEffect(() => setCurrentPage(1), [searchQuery, checkFilter, zoneFilter, lookbackDays]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

  const selected = tracked.find((s) => s.id === selectedId) ?? null;

  const save = (shipment: TrackedShipment, patch: ShipmentPatch, message: string, onDone?: () => void) =>
    updateShipment.mutate(
      { shipment, patch },
      {
        onSuccess: () => {
          toast({ title: message, description: shipment.shipment_ref });
          onDone?.();
        },
        onError: (error: Error) => toast({ title: 'Could not save', description: error.message, variant: 'destructive' }),
      }
    );

  const markNotified = (s: TrackedShipment) =>
    save(s, { customer_notified: true, notified_on: now.date }, 'Marked as notified');

  const markDelivered = (s: TrackedShipment) =>
    save(s, { status: 'DELIVERED', delivered_date: now.date }, 'Marked as delivered');

  const markRto = (s: TrackedShipment) => save(s, { status: 'RTO' }, 'Marked for RTO — now under Special cases');

  // Fill the dates a status implies; edit them in the panel if they differ.
  const changeStatus = (s: TrackedShipment, status: ShipmentStatus) => {
    if (status === s.status) return;
    save(
      s,
      {
        status,
        pickup_date:
          status === 'AWAITING_PICKUP' ? null : s.pickup_date ?? (status === 'CANCELLED' ? null : now.date),
        delivered_date: status === 'DELIVERED' ? s.delivered_date ?? now.date : null,
      },
      `Status changed to ${SHIPMENT_STATUS_LABELS[status]}`
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportShipmentsToExcel({ shipments: filtered, daily: report, stats });
    } catch (error) {
      toast({ title: 'Download failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const kpis: { title: string; value: number; icon: typeof Truck; color: string; filter: CheckFilter }[] = [
    { title: 'Escalated – RTO Review', value: stats.escalated, icon: RotateCcw, color: 'text-destructive', filter: 'ESCALATED' },
    { title: 'Delayed – Notify Now', value: stats.delayedNotify, icon: BellRing, color: 'text-destructive', filter: 'DELAYED_NOTIFY' },
    { title: 'Pickup Delayed', value: stats.pickupDelayed, icon: AlertTriangle, color: 'text-destructive', filter: 'PICKUP_DELAYED' },
    { title: 'Delayed – Notified', value: stats.delayedNotified, icon: Clock, color: 'text-warning', filter: 'DELAYED_NOTIFIED' },
    { title: 'Awaiting Pickup', value: stats.awaitingPickup, icon: PackageSearch, color: 'text-muted-foreground', filter: 'AWAITING_PICKUP' },
    { title: 'On Track', value: stats.onTrack, icon: Truck, color: 'text-info', filter: 'ON_TRACK' },
    { title: 'Delivered On Time', value: stats.deliveredOnTime, icon: PackageCheck, color: 'text-success', filter: 'DELIVERED_ON_TIME' },
    { title: 'Delivered Late', value: stats.deliveredLate, icon: PackageX, color: 'text-warning', filter: 'DELIVERED_LATE' },
  ];

  const secondaryStats: [string, string][] = [
    ['Total orders', String(stats.total)],
    ["Today's orders", String(stats.todaysOrders)],
    ['Out for delivery', String(stats.outForDelivery)],
    ['On-time', stats.onTimePercent === null ? '—' : `${stats.onTimePercent}%`],
    ['Avg days · NCR', stats.avgDaysNcr === null ? '—' : stats.avgDaysNcr.toFixed(1)],
    ['Avg days · Outside NCR', stats.avgDaysOutside === null ? '—' : stats.avgDaysOutside.toFixed(1)],
  ];

  const rowAction = (s: TrackedShipment) => {
    if (s.check === 'ESCALATED') {
      return { label: 'Mark RTO', onClick: () => markRto(s) };
    }
    if (s.check === 'DELAYED_NOTIFY') {
      return { label: 'Mark notified', onClick: () => markNotified(s) };
    }
    if (s.check === 'ON_TRACK' || s.check === 'DELAYED_NOTIFIED') {
      return { label: 'Mark delivered', onClick: () => markDelivered(s) };
    }
    return null;
  };

  const emptyMessage =
    shipments.length === 0
      ? 'No shipments yet. Sync from Shopify or import the old tracker sheet.'
      : 'No shipments match these filters.';

  return (
    <Layout>
      <div className="page-shell animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">Shipment Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {syncShipments.isPending
                ? 'Syncing with Shopify…'
                : lastSyncedAt
                  ? `Synced with Shopify ${formatDistanceToNow(parseISO(lastSyncedAt), { addSuffix: true })}`
                  : 'Not synced with Shopify yet'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Tracker settings">
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExport} disabled={exporting || tracked.length === 0}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{exporting ? 'Preparing…' : 'Excel'}</span>
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add</span>
            </Button>
            <Button className="gap-2" onClick={() => runSync()} disabled={syncShipments.isPending}>
              <RefreshCw className={cn('h-4 w-4', syncShipments.isPending && 'animate-spin')} />
              <span className="hidden sm:inline">Sync Shopify</span>
            </Button>
          </div>
        </div>

        {/* Daily summary — the two status lines from the sheet */}
        <Card className="border shadow-card px-4 py-3 space-y-1.5">
          {summary.map((line) => (
            <div key={line.text} className={cn('flex items-center gap-2 text-sm', line.ok ? 'text-success' : 'text-destructive font-medium')}>
              {line.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
              <span>{line.text}</span>
            </div>
          ))}
        </Card>

        {/* KPIs — click to filter the tracker */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map((kpi) => (
              <button
                key={kpi.title}
                type="button"
                onClick={() => setCheckFilter((current) => (current === kpi.filter ? 'open' : kpi.filter))}
                className={cn('text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', checkFilter === kpi.filter && 'ring-2 ring-primary')}
                aria-pressed={checkFilter === kpi.filter}
              >
                <KPICard title={kpi.title} value={kpi.value} icon={kpi.icon} color={kpi.color} />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm">
            {secondaryStats.map(([label, value]) => (
              <span key={label} className="text-muted-foreground">
                {label}: <span className="font-medium text-foreground">{value}</span>
              </span>
            ))}
          </div>
        </div>

        <Tabs defaultValue="tracker" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="tracker">Tracker</TabsTrigger>
              <TabsTrigger value="daily">Daily report</TabsTrigger>
              <TabsTrigger value="special">
                Special cases{openSpecialCount ? ` (${openSpecialCount})` : ''}
              </TabsTrigger>
            </TabsList>
            <Select value={lookbackDays === null ? 'all' : String(lookbackDays)} onValueChange={(v) => setLookbackDays(v === 'all' ? null : Number(v))}>
              <SelectTrigger className="w-[150px] rounded-full bg-card border-border/60 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="tracker" className="space-y-4 mt-0">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Order, customer, phone, AWB…"
                  className="pl-10 w-full rounded-full bg-card border-border/60 shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={checkFilter} onValueChange={(v) => setCheckFilter(v as CheckFilter)}>
                  <SelectTrigger className="w-[200px] rounded-full bg-card border-border/60 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open shipments</SelectItem>
                    <SelectItem value="needs_action">Needs action ({stats.escalated + stats.delayedNotify + stats.pickupDelayed})</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="all">All shipments</SelectItem>
                    {(Object.keys(DELIVERY_CHECK_LABELS) as DeliveryCheck[]).map((check) => (
                      <SelectItem key={check} value={check}>{DELIVERY_CHECK_LABELS[check]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={zoneFilter} onValueChange={(v) => setZoneFilter(v as 'all' | DeliveryZone)}>
                  <SelectTrigger className="w-[150px] rounded-full bg-card border-border/60 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All zones</SelectItem>
                    {Object.entries(DELIVERY_ZONE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mobile list (< lg) */}
            <div className="block lg:hidden rounded-2xl overflow-hidden border border-border bg-card">
              {isLoading ? (
                <div className="flex justify-center py-16"><div className="loader" /></div>
              ) : paginated.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
              ) : (
                paginated.map((s, idx) => {
                  const action = rowAction(s);
                  return (
                    <div
                      key={s.id}
                      className={cn('px-4 py-3 flex items-center gap-2 cursor-pointer active:bg-muted/50', idx < paginated.length - 1 && 'border-b border-border')}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[15px]">{s.shipment_ref}</span>
                          <DeliveryCheckBadge check={s.check} />
                        </div>
                        <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                          {s.customer_name || '—'} · {s.city || '—'} · {DELIVERY_ZONE_LABELS[s.delivery_zone]}
                        </p>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          {s.pickup_date ? `Picked up ${formatDay(s.pickup_date)}` : `Pickup due ${formatDay(s.pickupDue)}`}
                          {s.expectedDelivery ? ` · Due ${formatDay(s.expectedDelivery)}` : ''}
                          {s.daysDelayed ? ` · ${s.daysDelayed}d late` : ''}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <div onClick={(e) => e.stopPropagation()}>
                            <StatusSelect shipment={s} onChange={(status) => changeStatus(s, status)} disabled={updateShipment.isPending} />
                          </div>
                          {s.customer_phone && (
                            <a
                              href={`tel:${s.customer_phone.replace(/\s/g, '')}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[12px] font-medium text-primary"
                            >
                              Call
                            </a>
                          )}
                          {action && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                              className="text-[12px] font-medium text-primary"
                            >
                              {action.label}
                            </button>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </div>
                  );
                })
              )}
              {filtered.length > itemsPerPage && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop table (≥ lg) */}
            <div className="hidden lg:block">
              <Card className="border shadow-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">Order No.</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>City / Zone</TableHead>
                      <TableHead>Courier · AWB</TableHead>
                      <TableHead>Pickup</TableHead>
                      <TableHead className="whitespace-nowrap">Expected</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Transit</TableHead>
                      <TableHead className="whitespace-nowrap">Delivery Check</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Days Late</TableHead>
                      <TableHead>Notified</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={14} className="h-48 text-center">
                          <div className="flex justify-center"><div className="loader" /></div>
                        </TableCell>
                      </TableRow>
                    ) : paginated.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="h-32 text-center text-muted-foreground">{emptyMessage}</TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((s) => {
                        const action = rowAction(s);
                        return (
                          <TableRow
                            key={s.id}
                            className={cn('cursor-pointer hover:bg-muted/50', s.needsAction && 'bg-destructive/[0.03]')}
                            onClick={() => setSelectedId(s.id)}
                          >
                            <TableCell className="font-medium whitespace-nowrap text-primary">{s.shipment_ref}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDay(s.order_date)}</TableCell>
                            <TableCell className="max-w-[180px]">
                              <div className="font-medium truncate">{s.customer_name || '—'}</div>
                              {s.customer_phone && (
                                <a href={`tel:${s.customer_phone.replace(/\s/g, '')}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary">
                                  {s.customer_phone}
                                </a>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div>{s.city || '—'}</div>
                              <div className="text-xs text-muted-foreground">{DELIVERY_ZONE_LABELS[s.delivery_zone]}</div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div>{s.courier || '—'}</div>
                              <div className="text-xs"><AwbLink shipment={s} /></div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {s.pickup_date ? (
                                <span className={cn(s.pickedUpLate && 'text-warning')}>{formatDay(s.pickup_date)}</span>
                              ) : (
                                <span className="text-muted-foreground">due {formatDay(s.pickupDue)}</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{formatDay(s.expectedDelivery)}</TableCell>
                            <TableCell className="whitespace-nowrap">{s.status === 'DELIVERED' ? formatDay(s.delivered_date) : '—'}</TableCell>
                            <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <StatusSelect shipment={s} onChange={(status) => changeStatus(s, status)} disabled={updateShipment.isPending} />
                            </TableCell>
                            <TableCell className="text-right">{s.daysInTransit ?? '—'}</TableCell>
                            <TableCell><DeliveryCheckBadge check={s.check} /></TableCell>
                            <TableCell className={cn('text-right', s.daysDelayed !== null && 'text-destructive font-medium')}>{delayLabel(s)}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {s.customer_notified
                                ? ['Yes', s.notified_on && formatDay(s.notified_on), s.notified_via && NOTIFICATION_CHANNEL_LABELS[s.notified_via]].filter(Boolean).join(' · ')
                                : 'No'}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              {action && (
                                <button
                                  type="button"
                                  onClick={action.onClick}
                                  disabled={updateShipment.isPending}
                                  className="text-sm font-medium text-primary transition-all duration-150 hover:text-primary/70 disabled:opacity-50"
                                >
                                  {action.label}
                                </button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </Card>

              {filtered.length > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filtered.length)} of {filtered.length} shipments
                  </div>
                  <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    pageSize={itemsPerPage}
                    setPageSize={setItemsPerPage}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="daily" className="mt-0">
            <DailyReport rows={report} />
          </TabsContent>

          <TabsContent value="special" className="mt-0">
            <SpecialCases rtoShipments={rtoShipments} onOpenShipment={setSelectedId} />
          </TabsContent>
        </Tabs>

        {/* Edit */}
        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
            {selected && (
              <>
                <SheetHeader className="text-left space-y-2">
                  <SheetTitle>{selected.shipment_ref}</SheetTitle>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <DeliveryCheckBadge check={selected.check} />
                    <span>Ordered {formatDay(selected.order_date)}</span>
                    {selected.expectedDelivery && <span>· Due {formatDay(selected.expectedDelivery)}</span>}
                    {selected.daysDelayed ? <span className="text-destructive">· {selected.daysDelayed} day(s) late</span> : null}
                  </div>
                </SheetHeader>
                <div className="mt-6">
                  <ShipmentForm
                    key={selected.updated_at}
                    shipment={selected}
                    settings={settings}
                    submitting={updateShipment.isPending || deleteShipment.isPending}
                    submitLabel="Save changes"
                    onSubmit={(patch) => save(selected, patch, 'Shipment updated', () => setSelectedId(null))}
                    onDelete={
                      selected.source === 'MANUAL'
                        ? () => {
                            if (!window.confirm(`Delete ${selected.shipment_ref}? This cannot be undone.`)) return;
                            deleteShipment.mutate(selected.id, {
                              onSuccess: () => {
                                toast({ title: 'Shipment deleted', description: selected.shipment_ref });
                                setSelectedId(null);
                              },
                              onError: (error: Error) => toast({ title: 'Could not delete', description: error.message, variant: 'destructive' }),
                            });
                          }
                        : undefined
                    }
                  />
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Add (orders shipped outside Shopify) */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add shipment</DialogTitle>
            </DialogHeader>
            <ShipmentForm
              settings={settings}
              submitting={createShipment.isPending}
              submitLabel="Add shipment"
              onSubmit={(patch) =>
                createShipment.mutate(
                  { ...patch, order_name: patch.order_name!, order_date: patch.order_date! },
                  {
                    onSuccess: () => {
                      toast({ title: 'Shipment added', description: patch.order_name });
                      setAddOpen(false);
                    },
                    onError: (error: Error) => toast({ title: 'Could not add shipment', description: error.message, variant: 'destructive' }),
                  }
                )
              }
            />
          </DialogContent>
        </Dialog>

        {isAdmin && <ShipmentSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} />}
        <ImportTrackerDialog open={importOpen} onOpenChange={setImportOpen} />
      </div>
    </Layout>
  );
}
