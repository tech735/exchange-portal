import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Download, ExternalLink, Phone, Truck } from 'lucide-react';
import { BulkBar, BulkBarButton, EmptyState, FilterChip, RowSkeleton, SearchField, ToneBadge } from '@/components/app';
import { Checkbox } from '@/components/ui/checkbox';
import { ExportShipmentsDialog } from './ExportShipmentsDialog';
import type { Tone } from '@/lib/exchangeStatus';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useToast } from '@/hooks/use-toast';
import {
  DELIVERY_CHECK_LABELS,
  SHIPMENT_KIND_LABELS,
  dailyReport,
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
import { DELIVERY_ZONE_LABELS, type DeliveryZone, type ShipmentStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import { DeliveryCheckBadge } from './DeliveryCheckBadge';
import { LookbackSelect, DEFAULT_PERIOD, isDefaultPeriod, periodLabel, type Period } from './LookbackSelect';
import { CHECK_META } from './constants';

type CheckFilter = 'all' | 'needs_action' | 'open' | 'delivered' | DeliveryCheck;
type KindFilter = 'all' | Exclude<ShipmentKind, 'FORWARD'>;

const DEFAULT_CHECK: CheckFilter = 'open';
const OPEN_CHECKS: DeliveryCheck[] = ['ESCALATED', 'DELAYED_NOTIFY', 'PICKUP_DELAYED', 'DELAYED_NOTIFIED', 'AWAITING_PICKUP', 'ON_TRACK'];

const CHECK_FILTER_LABELS: Record<'all' | 'needs_action' | 'open' | 'delivered', string> = {
  open: 'Open shipments',
  needs_action: 'Needs action',
  delivered: 'Delivered',
  all: 'All shipments',
};

const checkFilterLabel = (f: CheckFilter) =>
  f in CHECK_FILTER_LABELS ? CHECK_FILTER_LABELS[f as keyof typeof CHECK_FILTER_LABELS] : CHECK_META[f as DeliveryCheck].short;

function matchesCheck(s: TrackedShipment, filter: CheckFilter) {
  if (filter === 'all') return true;
  if (filter === 'needs_action') return s.needsAction;
  if (filter === 'open') return OPEN_CHECKS.includes(s.check);
  if (filter === 'delivered') return s.check === 'DELIVERED_ON_TIME' || s.check === 'DELIVERED_LATE';
  return s.check === filter;
}

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

function AwbLink({ shipment }: { shipment: TrackedShipment }) {
  if (!shipment.awb_number) return <span className="text-faint">No AWB yet</span>;
  if (!shipment.tracking_url) return <span className="tabular">{shipment.awb_number}</span>;
  return (
    <a
      href={shipment.tracking_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 tabular text-primary hover:underline"
    >
      {shipment.awb_number}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

// Quick status change from the row itself, for when the courier's tracking
// hasn't caught up. Clicks are stopped by the parent so the row doesn't open
// the edit panel.
function StatusSelect({
  shipment,
  onChange,
  disabled,
  className,
}: {
  shipment: TrackedShipment;
  onChange: (status: ShipmentStatus) => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <Select value={shipment.status} onValueChange={(v) => onChange(v as ShipmentStatus)} disabled={disabled}>
      <SelectTrigger className={cn('h-8 w-[148px] text-[13px]', className)} aria-label={`Status of ${shipment.shipment_ref}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statusOptions(shipment.shipment_ref).map(([value, label]) => (
          <SelectItem key={value} value={value} className="text-[13px]">{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const delayLabel = (s: TrackedShipment) =>
  s.daysDelayed === null ? '—' : s.daysDelayed === 0 ? 'today' : `${s.daysDelayed}d`;

function PickupCell({ s }: { s: TrackedShipment }) {
  if (s.pickup_date) {
    return <span className={cn(s.pickedUpLate && 'text-warning')}>{formatDay(s.pickup_date)}</span>;
  }
  return <span className="text-muted-foreground">due {formatDay(s.pickupDue)}</span>;
}

function KindTag({ s }: { s: TrackedShipment }) {
  const kind = shipmentKind(s.shipment_ref);
  if (kind === 'FORWARD') return null;
  return (
    <ToneBadge tone={kind === 'RETURN' ? 'brand' : 'info'} dot={false} className="px-1.5 py-0 text-[11px]">
      {SHIPMENT_KIND_LABELS[kind]}
    </ToneBadge>
  );
}

/* ------------------------------------------------------------------ */
/* Stat pill — compact, clickable filter for one delivery check        */
/* ------------------------------------------------------------------ */

function StatPill({
  label,
  value,
  tone,
  active,
  onClick,
  loading,
}: {
  label: string;
  value: number;
  tone: Tone;
  active: boolean;
  onClick: () => void;
  loading: boolean;
}) {
  const toned = value > 0 && tone !== 'neutral';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-w-[108px] shrink-0 rounded-xl border bg-card px-3.5 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150 ease-out-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-w-0',
        active
          ? tone === 'danger'
            ? 'border-destructive/60 bg-destructive/[0.06] ring-[3px] ring-destructive/10'
            : 'border-primary ring-[3px] ring-primary/10'
          : 'border-border hover:border-input hover:shadow-card-hover',
      )}
    >
      {loading ? (
        <span className="block h-6 w-8 rounded bg-muted animate-pulse" />
      ) : (
        <span
          className={cn(
            'block font-heading text-lg font-semibold leading-6 tabular',
            toned && tone === 'danger' && 'text-destructive',
            toned && tone === 'warning' && 'text-warning',
            toned && tone === 'success' && 'text-success',
            !toned && 'text-foreground',
          )}
        >
          {value}
        </span>
      )}
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

/**
 * Action banner, check pills, filters and the table for one group of
 * shipments: forward orders on the Forward tab, exchanges and returns
 * (`reverse`) on theirs. Same rules and actions for both; the reverse view
 * adds a kind tag and filter and dates rows by the day they were raised.
 */
export function ShipmentList({
  variant,
  shipments,
  isLoading,
  isError,
  onRetry,
  today,
  reportSince,
  period,
  onPeriodChange,
  loadRange,
  busy,
  onOpen,
  onChangeStatus,
  onMarkNotified,
  onMarkAllNotified,
  onMarkDelivered,
  onMarkRto,
}: {
  variant: 'forward' | 'reverse';
  shipments: TrackedShipment[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  today: string;
  reportSince: string | null;
  period: Period;
  onPeriodChange: (p: Period) => void;
  loadRange: (from: string, to: string) => Promise<TrackedShipment[]>;
  busy: boolean;
  onOpen: (id: string) => void;
  onChangeStatus: (s: TrackedShipment, status: ShipmentStatus) => void;
  onMarkNotified: (s: TrackedShipment) => void;
  onMarkAllNotified: (rows: TrackedShipment[]) => Promise<void>;
  onMarkDelivered: (s: TrackedShipment) => void;
  onMarkRto: (s: TrackedShipment) => void;
}) {
  const { toast } = useToast();
  const reverse = variant === 'reverse';

  const [searchQuery, setSearchQuery] = useState('');
  const [checkFilter, setCheckFilter] = useState<CheckFilter>(DEFAULT_CHECK);
  const [zoneFilter, setZoneFilter] = useState<'all' | DeliveryZone>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [exportOpen, setExportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickExporting, setQuickExporting] = useState(false);
  const [confirmNotifyOpen, setConfirmNotifyOpen] = useState(false);
  const [notifyingAll, setNotifyingAll] = useState(false);

  const stats = useMemo(() => summarizeShipments(shipments, today), [shipments, today]);
  const toNotify = useMemo(() => shipments.filter((s) => s.check === 'DELAYED_NOTIFY'), [shipments]);
  const delayed = stats.delayedNotify + stats.delayedNotified + stats.escalated;

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
  // Selection only keeps rows that are still in the list.
  useEffect(() => setSelected((cur) => new Set([...cur].filter((id) => shipments.some((s) => s.id === id)))), [shipments]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

  const selectedRows = shipments.filter((s) => selected.has(s.id));
  const allOnPage = paginated.length > 0 && paginated.every((s) => selected.has(s.id));
  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePage = () => setSelected((cur) => { const n = new Set(cur); paginated.forEach((s) => (allOnPage ? n.delete(s.id) : n.add(s.id))); return n; });

  const exportSelected = async () => {
    setQuickExporting(true);
    try {
      await exportShipmentsToExcel({ shipments: selectedRows, daily: dailyReport(selectedRows, reportSince), stats: summarizeShipments(selectedRows, today), filename: `shipments-selected-${today}` });
    } catch (error) {
      toast({ title: 'Download failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setQuickExporting(false);
    }
  };

  const handleMarkAllNotified = async () => {
    setNotifyingAll(true);
    try {
      await onMarkAllNotified(toNotify);
      setConfirmNotifyOpen(false);
    } finally {
      setNotifyingAll(false);
    }
  };

  const pills: { label: string; value: number; check: DeliveryCheck }[] = [
    { label: 'RTO review', value: stats.escalated, check: 'ESCALATED' },
    { label: 'Notify now', value: stats.delayedNotify, check: 'DELAYED_NOTIFY' },
    { label: 'Pickup late', value: stats.pickupDelayed, check: 'PICKUP_DELAYED' },
    { label: 'Notified', value: stats.delayedNotified, check: 'DELAYED_NOTIFIED' },
    { label: 'Awaiting pickup', value: stats.awaitingPickup, check: 'AWAITING_PICKUP' },
    { label: 'On track', value: stats.onTrack, check: 'ON_TRACK' },
    { label: 'On time', value: stats.deliveredOnTime, check: 'DELIVERED_ON_TIME' },
    { label: 'Delivered late', value: stats.deliveredLate, check: 'DELIVERED_LATE' },
  ];
  // Pill tones follow the wireframe: only the late buckets carry colour.
  const pillTone = (check: DeliveryCheck): Tone =>
    check === 'DELAYED_NOTIFIED' || check === 'ON_TRACK' ? 'neutral' : CHECK_META[check].tone;

  const secondaryStats: [string, string][] = [
    [reverse ? 'Total' : 'Total orders', String(stats.total)],
    [reverse ? 'Raised today' : 'Today', String(stats.todaysOrders)],
    ['Out for delivery', String(stats.outForDelivery)],
    ['On-time', stats.onTimePercent === null ? '—' : `${stats.onTimePercent}%`],
    ['Avg days NCR', stats.avgDaysNcr === null ? '—' : stats.avgDaysNcr.toFixed(1)],
    ['Avg days outside', stats.avgDaysOutside === null ? '—' : stats.avgDaysOutside.toFixed(1)],
  ];

  const rowAction = (s: TrackedShipment) => {
    if (s.check === 'ESCALATED') return { label: 'Mark RTO', urgent: true, onClick: () => onMarkRto(s) };
    if (s.check === 'DELAYED_NOTIFY') return { label: 'Mark notified', urgent: true, onClick: () => onMarkNotified(s) };
    if (s.check === 'ON_TRACK' || s.check === 'DELAYED_NOTIFIED') return { label: 'Mark delivered', urgent: false, onClick: () => onMarkDelivered(s) };
    return null;
  };

  const activeChips: { key: string; label: string; clear: () => void }[] = [
    searchQuery.trim() && { key: 'q', label: `“${searchQuery.trim()}”`, clear: () => setSearchQuery('') },
    reverse && kindFilter !== 'all' && { key: 'kind', label: `Type: ${SHIPMENT_KIND_LABELS[kindFilter]}`, clear: () => setKindFilter('all') },
    checkFilter !== DEFAULT_CHECK && { key: 'check', label: `Check: ${checkFilterLabel(checkFilter)}`, clear: () => setCheckFilter(DEFAULT_CHECK) },
    zoneFilter !== 'all' && { key: 'zone', label: `Zone: ${DELIVERY_ZONE_LABELS[zoneFilter]}`, clear: () => setZoneFilter('all') },
    !isDefaultPeriod(period) && {
      key: 'lookback',
      label: periodLabel(period),
      clear: () => onPeriodChange(DEFAULT_PERIOD),
    },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const clearAll = () => {
    setSearchQuery('');
    setKindFilter('all');
    setCheckFilter(DEFAULT_CHECK);
    setZoneFilter('all');
    if (!isDefaultPeriod(period)) onPeriodChange(DEFAULT_PERIOD);
  };

  const noData = shipments.length === 0;
  const emptyState = noData ? (
    <EmptyState
      icon={Truck}
      title={reverse ? 'No exchanges or returns yet' : 'No shipments yet'}
      description={
        reverse
          ? 'They come in with the Shopify sync (F2 onwards and returns).'
          : 'Sync from Shopify or import the old tracker sheet.'
      }
    />
  ) : (
    <EmptyState
      icon={Truck}
      title="No shipments match these filters"
      description="Try another check, zone or a longer period."
      action={activeChips.length > 0 ? <Button variant="secondary" size="sm" onClick={clearAll}>Clear filters</Button> : undefined}
    />
  );

  const errorState = (
    <EmptyState
      icon={AlertTriangle}
      title="Couldn't load shipments"
      description="Check your connection and try again."
      action={<Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    />
  );

  /* ---------------------------------------------------------------- */
  /* Banner                                                            */
  /* ---------------------------------------------------------------- */

  const banner = isLoading || isError ? null : delayed > 0 ? (
    <div role="status" className="flex flex-col gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-destructive sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {plural(delayed, 'shipment')} {delayed === 1 ? 'is' : 'are'} past {delayed === 1 ? 'its' : 'their'} delivery deadline
          </p>
          <p className="mt-0.5 text-xs text-destructive/90">
            {[
              stats.delayedNotify > 0 && `${plural(stats.delayedNotify, 'customer')} ${stats.delayedNotify === 1 ? "hasn't" : "haven't"} been told yet`,
              stats.escalated > 0 && `${stats.escalated} ${stats.escalated === 1 ? 'needs' : 'need'} an RTO review`,
              stats.pickupDelayed > 0 && `${plural(stats.pickupDelayed, 'order')} not picked up on time`,
            ]
              .filter(Boolean)
              .join(' · ') || 'Every customer has been told'}
          </p>
        </div>
      </div>
      {toNotify.length > 0 && (
        <Button variant="destructive" size="sm" className="self-start sm:self-auto" onClick={() => setConfirmNotifyOpen(true)} disabled={busy || notifyingAll}>
          Mark {toNotify.length} notified
        </Button>
      )}
    </div>
  ) : stats.pickupDelayed > 0 ? (
    <div role="status" className="flex items-start gap-2.5 rounded-xl bg-warning/10 px-4 py-3 text-warning">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="text-sm font-semibold">{plural(stats.pickupDelayed, 'order')} not picked up by the deadline</p>
        <p className="mt-0.5 text-xs">No delivery delays — everything picked up is within its deadline.</p>
      </div>
    </div>
  ) : (
    <p role="status" className="flex items-center gap-2 px-1 text-sm text-success">
      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      Nothing is late — no pickup or delivery delays today.
    </p>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {banner}

      {/* Delivery-check pills — click to filter the table */}
      <div className="space-y-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-hide sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 xl:grid-cols-8">
          {pills.map((p) => (
            <StatPill
              key={p.check}
              label={p.label}
              value={p.value}
              tone={pillTone(p.check)}
              loading={isLoading}
              active={checkFilter === p.check}
              onClick={() => setCheckFilter((current) => (current === p.check ? DEFAULT_CHECK : p.check))}
            />
          ))}
        </div>
        {!isLoading && (
          <p className="px-1 text-xs text-muted-foreground">
            {secondaryStats.map(([label, value], i) => (
              <span key={label}>
                {i > 0 && <span className="px-1.5 text-faint" aria-hidden>·</span>}
                {label} <span className="font-medium text-foreground tabular">{value}</span>
              </span>
            ))}
          </p>
        )}
      </div>

      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Order, customer, phone, AWB…"
            className="w-full md:w-64"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {reverse && (
              <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as KindFilter)}>
                <SelectTrigger className="sm:w-[170px]" aria-label="Type">
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
              <SelectTrigger className="sm:w-[190px]" aria-label="Delivery check">
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
              <SelectTrigger className="sm:w-[140px]" aria-label="Zone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All zones</SelectItem>
                {Object.entries(DELIVERY_ZONE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <LookbackSelect value={period} onChange={onPeriodChange} className="sm:w-[150px]" />
          </div>
          <Button variant="secondary" className="md:ml-auto" onClick={() => setExportOpen(true)}>
            <Download />
            Export
          </Button>
        </div>
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map((c) => (
              <FilterChip key={c.key} label={c.label} onRemove={c.clear} />
            ))}
            <button type="button" onClick={clearAll} className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Phone list (< md) */}
      <div className="md:hidden overflow-hidden rounded-xl border border-border bg-card">
        {isError ? (
          errorState
        ) : isLoading ? (
          <RowSkeleton rows={5} />
        ) : paginated.length === 0 ? (
          emptyState
        ) : (
          <ul className="divide-y divide-border">
            {paginated.map((s) => {
              const action = rowAction(s);
              return (
                <li
                  key={s.id}
                  className={cn('cursor-pointer px-4 py-3.5 active:bg-muted/60', s.needsAction && 'bg-destructive/[0.04]')}
                  onClick={() => onOpen(s.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span onClick={(e) => e.stopPropagation()} className="pt-1"><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} aria-label={`Select ${s.shipment_ref}`} /></span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-semibold text-foreground">{s.shipment_ref}</span>
                        <KindTag s={s} />
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                        {s.customer_name || '—'} · {s.city || '—'} · {DELIVERY_ZONE_LABELS[s.delivery_zone]}
                      </p>
                    </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <DeliveryCheckBadge check={s.check} />
                      <ChevronRight className="size-4 text-faint" aria-hidden />
                    </div>
                  </div>

                  <dl className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Picked up</dt>
                      <dd className="mt-0.5 text-foreground"><PickupCell s={s} /></dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Expected</dt>
                      <dd className="mt-0.5 text-foreground">{formatDay(s.expectedDelivery)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Late</dt>
                      <dd className={cn('mt-0.5', s.daysDelayed !== null ? 'font-medium text-destructive' : 'text-foreground')}>{delayLabel(s)}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    {s.courier || 'No courier'} · <AwbLink shipment={s} />
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <StatusSelect shipment={s} onChange={(status) => onChangeStatus(s, status)} disabled={busy} className="h-9 flex-1 min-w-[140px]" />
                    {s.customer_phone && (
                      <Button variant="secondary" size="icon" asChild>
                        <a href={`tel:${s.customer_phone.replace(/\s/g, '')}`} aria-label={`Call ${s.customer_name || 'customer'}`}>
                          <Phone />
                        </a>
                      </Button>
                    )}
                    {action && (
                      <Button variant={action.urgent ? 'secondary' : 'ghost'} onClick={action.onClick} disabled={busy}>
                        {action.label}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {filtered.length > itemsPerPage && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground tabular">Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
              <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Table (md+) */}
      <div className="hidden md:block space-y-3">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {isError ? (
            errorState
          ) : isLoading ? (
            <RowSkeleton rows={8} />
          ) : paginated.length === 0 ? (
            emptyState
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10"><Checkbox checked={allOnPage} onCheckedChange={togglePage} aria-label="Select page" /></TableHead>
                  <TableHead>Order · customer</TableHead>
                  <TableHead>Courier · AWB</TableHead>
                  <TableHead className="hidden lg:table-cell">Zone</TableHead>
                  <TableHead className="whitespace-nowrap">Picked up</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check</TableHead>
                  <TableHead className="text-right">Late</TableHead>
                  <TableHead><span className="sr-only">Action</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((s) => {
                  const action = rowAction(s);
                  return (
                    <TableRow
                      key={s.id}
                      className={cn('cursor-pointer', s.needsAction && 'bg-destructive/[0.04] hover:bg-destructive/[0.07]', selected.has(s.id) && 'bg-accent/60 hover:bg-accent')}
                      onClick={() => onOpen(s.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} aria-label={`Select ${s.shipment_ref}`} /></TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium text-foreground">{s.shipment_ref}</span>
                          <KindTag s={s} />
                        </div>
                        <div className="truncate text-xs text-muted-foreground" title={`${reverse ? 'Raised' : 'Ordered'} ${formatDay(raisedOn(s), 'd MMM yyyy')}`}>
                          {s.customer_name || '—'}{s.city ? ` · ${s.city}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-foreground">{s.courier || '—'}</div>
                        <div className="text-xs"><AwbLink shipment={s} /></div>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap lg:table-cell">{DELIVERY_ZONE_LABELS[s.delivery_zone]}</TableCell>
                      <TableCell className="whitespace-nowrap"><PickupCell s={s} /></TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div>{formatDay(s.expectedDelivery)}</div>
                        {s.status === 'DELIVERED' && s.delivered_date && (
                          <div className="text-xs text-muted-foreground">delivered {formatDay(s.delivered_date)}</div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <StatusSelect shipment={s} onChange={(status) => onChangeStatus(s, status)} disabled={busy} />
                      </TableCell>
                      <TableCell><DeliveryCheckBadge check={s.check} /></TableCell>
                      <TableCell className={cn('whitespace-nowrap text-right tabular', s.daysDelayed !== null ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                        {delayLabel(s)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        {action && (
                          <Button variant={action.urgent ? 'secondary' : 'ghost'} size="sm" onClick={action.onClick} disabled={busy}>
                            {action.label}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {!isLoading && !isError && filtered.length > 0 && (
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-muted-foreground tabular">
              Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filtered.length)} of {filtered.length} shipments
            </p>
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

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <BulkBarButton onClick={exportSelected} disabled={quickExporting}><Download /> {quickExporting ? 'Preparing…' : 'Download Excel'}</BulkBarButton>
        <BulkBarButton onClick={() => setExportOpen(true)}>More options…</BulkBarButton>
      </BulkBar>

      <ExportShipmentsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        variant={variant}
        viewRows={filtered}
        selectedRows={selectedRows}
        today={today}
        loadRange={loadRange}
      />

      {/* Bulk "mark notified" confirmation */}
      <Dialog open={confirmNotifyOpen} onOpenChange={(open) => !notifyingAll && setConfirmNotifyOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark {plural(toNotify.length, 'customer')} as notified?</DialogTitle>
            <DialogDescription>
              Records that {toNotify.length === 1 ? 'this customer was' : 'these customers were'} told about the delay today.
              No message is sent from here — only do this once they've actually been contacted.
            </DialogDescription>
          </DialogHeader>
          {toNotify.length > 0 && (
            <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
              {toNotify.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate">
                    <span className="font-medium text-foreground">{s.shipment_ref}</span>
                    <span className="text-muted-foreground"> · {s.customer_name || '—'}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-destructive tabular">{delayLabel(s)} late</span>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmNotifyOpen(false)} disabled={notifyingAll}>Cancel</Button>
            <Button variant="destructive" onClick={handleMarkAllNotified} disabled={notifyingAll || toNotify.length === 0}>
              {notifyingAll ? 'Saving…' : `Mark ${toNotify.length} notified`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
