import { useEffect, useMemo, useState } from 'react';
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
  RotateCcw,
  Search,
  Truck,
} from 'lucide-react';
import { KPICard } from '@/pages/Dashboard/KPICard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useToast } from '@/hooks/use-toast';
import {
  DELIVERY_CHECK_LABELS,
  dailyReport,
  dailySummary,
  formatDay,
  raisedOn,
  shipmentKind,
  statusOptions,
  summarizeShipments,
  type DeliveryCheck,
  type ShipmentKind,
  type TrackedShipment,
} from '@/lib/shipmentTracking';
import { exportShipmentsToExcel } from '@/utils/exportUtils';
import {
  DELIVERY_ZONE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  type DeliveryZone,
  type ShipmentStatus,
} from '@/types/database';
import { cn } from '@/lib/utils';
import { DeliveryCheckBadge } from './DeliveryCheckBadge';

type CheckFilter = 'all' | 'needs_action' | 'open' | 'delivered' | DeliveryCheck;
type KindFilter = 'all' | Exclude<ShipmentKind, 'FORWARD'>;

const OPEN_CHECKS: DeliveryCheck[] = ['ESCALATED', 'DELAYED_NOTIFY', 'PICKUP_DELAYED', 'DELAYED_NOTIFIED', 'AWAITING_PICKUP', 'ON_TRACK'];

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
// hasn't caught up. Clicks are stopped by the parent cell so the row doesn't
// open the edit panel.
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
        {statusOptions(shipment.shipment_ref).map(([value, label]) => (
          <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const delayLabel = (s: TrackedShipment) =>
  s.daysDelayed === null ? '—' : s.daysDelayed === 0 ? 'today' : String(s.daysDelayed);

/**
 * Summary, KPIs, filters and the table for one group of shipments: forward
 * orders on the Tracker tab, exchanges and returns (`reverse`) on theirs.
 * Same rules and actions for both; the reverse view adds a kind tag and
 * filter and dates rows by the day they were raised.
 */
export function ShipmentList({
  variant,
  shipments,
  isLoading,
  today,
  reportSince,
  busy,
  onOpen,
  onChangeStatus,
  onMarkNotified,
  onMarkDelivered,
  onMarkRto,
}: {
  variant: 'forward' | 'reverse';
  shipments: TrackedShipment[];
  isLoading: boolean;
  today: string;
  reportSince: string | null;
  busy: boolean;
  onOpen: (id: string) => void;
  onChangeStatus: (s: TrackedShipment, status: ShipmentStatus) => void;
  onMarkNotified: (s: TrackedShipment) => void;
  onMarkDelivered: (s: TrackedShipment) => void;
  onMarkRto: (s: TrackedShipment) => void;
}) {
  const { toast } = useToast();
  const reverse = variant === 'reverse';

  const [searchQuery, setSearchQuery] = useState('');
  const [checkFilter, setCheckFilter] = useState<CheckFilter>('open');
  const [zoneFilter, setZoneFilter] = useState<'all' | DeliveryZone>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [exporting, setExporting] = useState(false);

  const stats = useMemo(() => summarizeShipments(shipments, today), [shipments, today]);
  const summary = dailySummary(stats, today);

  const filtered = shipments.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      [s.shipment_ref, s.customer_name, s.customer_phone, s.customer_email, s.city, s.awb_number]
        .some((v) => v?.toLowerCase().includes(q));
    const matchesZone = zoneFilter === 'all' || s.delivery_zone === zoneFilter;
    const matchesKind = kindFilter === 'all' || shipmentKind(s.shipment_ref) === kindFilter;
    return matchesSearch && matchesZone && matchesKind && matchesCheck(s, checkFilter);
  });

  useEffect(() => setCurrentPage(1), [searchQuery, checkFilter, zoneFilter, kindFilter, reportSince]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportShipmentsToExcel({ shipments: filtered, daily: dailyReport(shipments, reportSince), stats });
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
    [reverse ? 'Total shipments' : 'Total orders', String(stats.total)],
    [reverse ? 'Raised today' : "Today's orders", String(stats.todaysOrders)],
    ['Out for delivery', String(stats.outForDelivery)],
    ['On-time', stats.onTimePercent === null ? '—' : `${stats.onTimePercent}%`],
    ['Avg days · NCR', stats.avgDaysNcr === null ? '—' : stats.avgDaysNcr.toFixed(1)],
    ['Avg days · Outside NCR', stats.avgDaysOutside === null ? '—' : stats.avgDaysOutside.toFixed(1)],
  ];

  const rowAction = (s: TrackedShipment) => {
    if (s.check === 'ESCALATED') return { label: 'Mark RTO', onClick: () => onMarkRto(s) };
    if (s.check === 'DELAYED_NOTIFY') return { label: 'Mark notified', onClick: () => onMarkNotified(s) };
    if (s.check === 'ON_TRACK' || s.check === 'DELAYED_NOTIFIED') return { label: 'Mark delivered', onClick: () => onMarkDelivered(s) };
    return null;
  };

  const emptyMessage =
    shipments.length === 0
      ? reverse
        ? 'No exchanges or returns yet. They come in with the Shopify sync (F2 onwards and returns).'
        : 'No shipments yet. Sync from Shopify or import the old tracker sheet.'
      : 'No shipments match these filters.';

  return (
    <div className="space-y-4">
      {/* Daily summary — the two status lines from the sheet */}
      <Card className="border shadow-card px-4 py-3 space-y-1.5">
        {summary.map((line) => (
          <div key={line.text} className={cn('flex items-center gap-2 text-sm', line.ok ? 'text-success' : 'text-destructive font-medium')}>
            {line.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{line.text}</span>
          </div>
        ))}
      </Card>

      {/* KPIs — click to filter the table */}
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
          {reverse && (
            <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as KindFilter)}>
              <SelectTrigger className="w-[170px] rounded-full bg-card border-border/60 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Exchanges &amp; returns</SelectItem>
                <SelectItem value="EXCHANGE">Exchanges only</SelectItem>
                <SelectItem value="RETURN">Returns only</SelectItem>
              </SelectContent>
            </Select>
          )}
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
        <Button variant="outline" className="gap-2 sm:ml-auto rounded-full" onClick={handleExport} disabled={exporting || filtered.length === 0}>
          <Download className="h-4 w-4" />
          {exporting ? 'Preparing…' : 'Excel'}
        </Button>
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
                onClick={() => onOpen(s.id)}
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
                      <StatusSelect shipment={s} onChange={(status) => onChangeStatus(s, status)} disabled={busy} />
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
                <TableHead>{reverse ? 'Raised' : 'Ordered'}</TableHead>
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
                      onClick={() => onOpen(s.id)}
                    >
                      <TableCell className="font-medium whitespace-nowrap text-primary">{s.shipment_ref}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDay(raisedOn(s))}</TableCell>
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
                        <StatusSelect shipment={s} onChange={(status) => onChangeStatus(s, status)} disabled={busy} />
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
                            disabled={busy}
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
    </div>
  );
}
