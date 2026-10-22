import { useEffect, useMemo, useRef, useState } from 'react';
import { differenceInMinutes, formatDistanceToNow, parseISO, subDays } from 'date-fns';
import { Plus, RefreshCw, SlidersHorizontal, Upload } from 'lucide-react';
import Layout from '@/components/Layout';
import { PageHeader, ViewTabs } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import {
  useCreateShipment,
  useDeleteShipment,
  useShipmentSettings,
  useShipments,
  useSyncShipments,
  useUpdateShipment,
  type ShipmentPatch,
} from '@/hooks/useShipments';
import {
  DEFAULT_SHIPMENT_SETTINGS,
  dailyReport,
  formatDay,
  istNow,
  shipmentKind,
  toDateInput,
  trackShipments,
  type DeliveryCheck,
  type ShipmentSettings,
  type TrackedShipment,
} from '@/lib/shipmentTracking';
import { DELIVERY_ZONE_LABELS, SHIPMENT_STATUS_LABELS, type Shipment, type ShipmentStatus } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { DeliveryCheckBadge } from './DeliveryCheckBadge';
import { ShipmentForm } from './ShipmentForm';
import { ShipmentList } from './ShipmentList';
import { ShipmentSettingsDialog } from './ShipmentSettingsDialog';
import { ImportTrackerDialog } from './ImportTrackerDialog';
import { DailyReport } from './DailyReport';
import { LookbackSelect, DEFAULT_PERIOD, inPeriod, periodLoadDays, periodSince, type Period } from './LookbackSelect';

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

// Re-pull from Shopify on open when the last sync is older than this.
const AUTO_SYNC_AFTER_MINUTES = 30;

type View = 'forward' | 'reverse' | 'daily';

const hourLabel = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);

// The deadline rules in plain words, for the page description.
function rulesSummary(s: ShipmentSettings) {
  const by = hourLabel(s.pickup_deadline_hour);
  const pickup =
    s.pickup_deadline_days === 0
      ? `pickup by ${by} same day`
      : s.pickup_deadline_days === 1
        ? `pickup by ${by} next day`
        : `pickup within ${s.pickup_deadline_days} days, by ${by}`;
  const delivery = `delivery ${s.ncr_delivery_days} days NCR / ${s.outside_ncr_delivery_days} days outside`;
  return [pickup, delivery, s.skip_sundays && 'Sundays not counted'].filter(Boolean).join(' · ');
}

export default function Shipments() {
  const { toast } = useToast();
  const { user, hasFullAccess } = useUser();
  const isAdmin = hasFullAccess() || user?.role === 'ADMIN';

  const [view, setView] = useState<View>('forward');
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const { data: shipments = [], isLoading, isError, refetch } = useShipments(periodLoadDays(period));
  const { data: settings = DEFAULT_SHIPMENT_SETTINGS } = useShipmentSettings();
  const syncShipments = useSyncShipments();
  const updateShipment = useUpdateShipment();
  const createShipment = useCreateShipment();
  const deleteShipment = useDeleteShipment();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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
      trackShipments(shipments.filter((s) => inPeriod(period, s)), settings, now).sort(
        (a, b) =>
          CHECK_PRIORITY[a.check] - CHECK_PRIORITY[b.check] ||
          (b.raised_date ?? b.order_date).localeCompare(a.raised_date ?? a.order_date) ||
          // Same day: newest order number first, then an order's parcels as -F1, -F2 …
          b.order_name.localeCompare(a.order_name, undefined, { numeric: true }) ||
          a.shipment_ref.localeCompare(b.shipment_ref, undefined, { numeric: true })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` matters only per hour
    [shipments, settings, clockKey, period]
  );

  // Orders on the Forward tab; exchanges (F2 onwards) and returns on their own.
  const forward = useMemo(() => tracked.filter((s) => shipmentKind(s.shipment_ref) === 'FORWARD'), [tracked]);
  const reverse = useMemo(() => tracked.filter((s) => shipmentKind(s.shipment_ref) !== 'FORWARD'), [tracked]);
  const reverseNeedsAction = reverse.filter((s) => s.needsAction).length;

  const reportSince = periodSince(period);
  const report = useMemo(
    () => dailyReport(tracked.filter((s) => shipmentKind(s.shipment_ref) !== 'EXCHANGE'), reportSince),
    [tracked, reportSince]
  );

  const lastSyncedAt = useMemo(() => {
    const times = shipments.map((s) => s.last_synced_at).filter(Boolean) as string[];
    return times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
  }, [shipments]);

  const runSync = (silent = false) =>
    syncShipments.mutate(undefined, {
      onSuccess: (result) => {
        const returnsError = result.returns && 'error' in result.returns ? result.returns.error : null;
        if (returnsError) {
          toast({ title: 'Returns not synced', description: returnsError, variant: 'destructive' });
        }
        if (!silent) {
          const returns = result.returns && !('error' in result.returns) ? ` · ${result.returns.returns} returns` : '';
          toast({
            title: 'Shipments synced',
            description: `${result.ordersScanned} Shopify orders checked · ${result.created} new · ${result.updated} updated${returns}`,
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

  // Same update as the row's "Mark notified", applied to every listed row.
  const markAllNotified = async (rows: TrackedShipment[]) => {
    const results = await Promise.allSettled(
      rows.map((shipment) =>
        updateShipment.mutateAsync({ shipment, patch: { customer_notified: true, notified_on: now.date } })
      )
    );
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    const done = results.length - failed.length;
    if (done) toast({ title: `${done} ${done === 1 ? 'shipment' : 'shipments'} marked as notified` });
    if (failed.length) {
      toast({
        title: `${failed.length} could not be saved`,
        description: (failed[0].reason as Error)?.message,
        variant: 'destructive',
      });
    }
  };

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

  const deleteSelected = () => {
    if (!selected) return;
    deleteShipment.mutate(selected.id, {
      onSuccess: () => {
        toast({ title: 'Shipment deleted', description: selected.shipment_ref });
        setConfirmDeleteOpen(false);
        setSelectedId(null);
      },
      onError: (error: Error) => toast({ title: 'Could not delete', description: error.message, variant: 'destructive' }),
    });
  };

  /** Shipments ordered or raised in an exact date range, for exports beyond what is loaded. */
  const loadRange = async (from: string, to: string) => {
    const { data, error } = await supabase
      .from('order_shipments')
      .select('*')
      .or(`and(order_date.gte.${from},order_date.lte.${to}),and(raised_date.gte.${from},raised_date.lte.${to})`);
    if (error) throw error;
    return trackShipments(((data || []) as Shipment[]).filter((s) => inPeriod({ kind: 'range', from, to }, s)), settings, now);
  };

  const listProps = {
    isLoading,
    isError,
    onRetry: () => void refetch(),
    today: now.date,
    reportSince,
    period,
    onPeriodChange: setPeriod,
    loadRange,
    busy: updateShipment.isPending,
    onOpen: setSelectedId,
    onChangeStatus: changeStatus,
    onMarkNotified: (s: TrackedShipment) => save(s, { customer_notified: true, notified_on: now.date }, 'Marked as notified'),
    onMarkAllNotified: markAllNotified,
    onMarkDelivered: (s: TrackedShipment) => save(s, { status: 'DELIVERED', delivered_date: now.date }, 'Marked as delivered'),
    onMarkRto: (s: TrackedShipment) => save(s, { status: 'RTO' }, 'Marked for RTO — now under Cases'),
  };

  const syncState = syncShipments.isPending
    ? 'Syncing with Shopify…'
    : lastSyncedAt
      ? `Synced with Shopify ${formatDistanceToNow(parseISO(lastSyncedAt), { addSuffix: true })}`
      : 'Not synced with Shopify yet';

  return (
    <Layout>
      <div className="space-y-5">
        <PageHeader
          title="Shipments"
          description={`${syncState} · ${rulesSummary(settings)}`}
          actions={
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload />
                Import
              </Button>
              <Button variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus />
                Add
              </Button>
              {isAdmin && (
                <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
                  <SlidersHorizontal />
                  Rules
                </Button>
              )}
              <Button onClick={() => runSync()} disabled={syncShipments.isPending}>
                <RefreshCw className={cn(syncShipments.isPending && 'animate-spin')} />
                {syncShipments.isPending ? 'Syncing…' : 'Sync'}
              </Button>
            </>
          }
        />

        <ViewTabs<View>
          value={view}
          onChange={setView}
          views={[
            { id: 'forward', label: 'Forward' },
            { id: 'reverse', label: 'Exchanges & returns', count: reverseNeedsAction || undefined },
            { id: 'daily', label: 'Daily report' },
          ]}
        />

        {view === 'forward' && <ShipmentList key="forward" variant="forward" shipments={forward} {...listProps} />}

        {view === 'reverse' && <ShipmentList key="reverse" variant="reverse" shipments={reverse} {...listProps} />}

        {view === 'daily' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Orders placed, picked up and delivered each day. Returns count on the day they were raised.
              </p>
              <LookbackSelect value={period} onChange={setPeriod} className="sm:w-[150px]" />
            </div>
            <DailyReport rows={report} isLoading={isLoading} isError={isError} onRetry={() => void refetch()} />
          </div>
        )}
      </div>

      {/* Edit */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 bg-card p-0 sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader className="space-y-2 border-b border-border px-5 pb-4 pt-5 pr-12 text-left sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="font-heading">{selected.shipment_ref}</SheetTitle>
                  <DeliveryCheckBadge check={selected.check} />
                </div>
                <SheetDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]">
                  <span>{selected.customer_name || 'No customer name'}{selected.city ? ` · ${selected.city}` : ''} · {DELIVERY_ZONE_LABELS[selected.delivery_zone]}</span>
                </SheetDescription>
                <p className="flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
                  <span>Ordered {formatDay(selected.order_date)}</span>
                  {selected.raised_date && <span>· Raised {formatDay(selected.raised_date)}</span>}
                  {selected.expectedDelivery && <span>· Due {formatDay(selected.expectedDelivery)}</span>}
                  {selected.daysDelayed ? <span className="font-medium text-destructive">· {selected.daysDelayed} day(s) late</span> : null}
                </p>
              </SheetHeader>
              <ShipmentForm
                key={selected.updated_at}
                shipment={selected}
                settings={settings}
                submitting={updateShipment.isPending || deleteShipment.isPending}
                submitLabel="Save changes"
                onSubmit={(patch) => save(selected, patch, 'Shipment updated', () => setSelectedId(null))}
                onDelete={selected.source === 'MANUAL' ? () => setConfirmDeleteOpen(true) : undefined}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add (orders shipped outside Shopify) */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 bg-card p-0 sm:max-w-xl">
          <SheetHeader className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12 text-left sm:px-6">
            <SheetTitle className="font-heading">Add shipment</SheetTitle>
            <SheetDescription>For orders, exchanges or returns that don't come in from Shopify.</SheetDescription>
          </SheetHeader>
          {addOpen && (
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
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation (manual shipments only) */}
      <Dialog open={confirmDeleteOpen} onOpenChange={(open) => !deleteShipment.isPending && setConfirmDeleteOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selected?.shipment_ref}?</DialogTitle>
            <DialogDescription>This removes the shipment from the tracker. It cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)} disabled={deleteShipment.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={deleteSelected} disabled={deleteShipment.isPending}>
              {deleteShipment.isPending ? 'Deleting…' : 'Delete shipment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin && <ShipmentSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} />}
      <ImportTrackerDialog open={importOpen} onOpenChange={setImportOpen} />
    </Layout>
  );
}
