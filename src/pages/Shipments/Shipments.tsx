import { useEffect, useMemo, useRef, useState } from 'react';
import { differenceInMinutes, formatDistanceToNow, parseISO, subDays } from 'date-fns';
import { Plus, RefreshCw, Settings, Upload } from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  dailyReport,
  formatDay,
  istNow,
  shipmentKind,
  toDateInput,
  trackShipments,
  type DeliveryCheck,
  type TrackedShipment,
} from '@/lib/shipmentTracking';
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import { DeliveryCheckBadge } from './DeliveryCheckBadge';
import { ShipmentForm } from './ShipmentForm';
import { ShipmentList } from './ShipmentList';
import { ShipmentSettingsDialog } from './ShipmentSettingsDialog';
import { ImportTrackerDialog } from './ImportTrackerDialog';
import { DailyReport } from './DailyReport';
import { SpecialCases } from './SpecialCases';

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

export default function Shipments() {
  const { toast } = useToast();
  const { user, hasFullAccess } = useUser();
  const isAdmin = hasFullAccess() || user?.role === 'ADMIN';

  const [lookbackDays, setLookbackDays] = useState<number | null>(30);
  const { data: shipments = [], isLoading } = useShipments(lookbackDays);
  const { data: settings = DEFAULT_SHIPMENT_SETTINGS } = useShipmentSettings();
  const { data: specialCases = [] } = useSpecialCases();
  const syncShipments = useSyncShipments();
  const updateShipment = useUpdateShipment();
  const createShipment = useCreateShipment();
  const deleteShipment = useDeleteShipment();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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
          (b.raised_date ?? b.order_date).localeCompare(a.raised_date ?? a.order_date) ||
          // Same day: newest order number first, then an order's parcels as -F1, -F2 …
          b.order_name.localeCompare(a.order_name, undefined, { numeric: true }) ||
          a.shipment_ref.localeCompare(b.shipment_ref, undefined, { numeric: true })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` matters only per hour
    [shipments, settings, clockKey]
  );

  // Orders on the Tracker tab; exchanges (F2 onwards) and returns on their own.
  const forward = useMemo(() => tracked.filter((s) => shipmentKind(s.shipment_ref) === 'FORWARD'), [tracked]);
  const reverse = useMemo(() => tracked.filter((s) => shipmentKind(s.shipment_ref) !== 'FORWARD'), [tracked]);
  const reverseNeedsAction = reverse.filter((s) => s.needsAction).length;

  const reportSince = lookbackDays === null ? null : toDateInput(subDays(new Date(), lookbackDays));
  const report = useMemo(
    () => dailyReport(tracked.filter((s) => shipmentKind(s.shipment_ref) !== 'EXCHANGE'), reportSince),
    [tracked, reportSince]
  );
  const rtoShipments = useMemo(() => tracked.filter((s) => s.check === 'RTO'), [tracked]);
  const openSpecialCount =
    rtoShipments.filter((s) => !s.resolved_on).length + specialCases.filter((c) => c.status === 'OPEN').length;

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

  const listProps = {
    isLoading,
    today: now.date,
    reportSince,
    busy: updateShipment.isPending,
    onOpen: setSelectedId,
    onChangeStatus: changeStatus,
    onMarkNotified: (s: TrackedShipment) => save(s, { customer_notified: true, notified_on: now.date }, 'Marked as notified'),
    onMarkDelivered: (s: TrackedShipment) => save(s, { status: 'DELIVERED', delivered_date: now.date }, 'Marked as delivered'),
    onMarkRto: (s: TrackedShipment) => save(s, { status: 'RTO' }, 'Marked for RTO — now under Special cases'),
  };

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

        <Tabs defaultValue="tracker" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="tracker">Forward</TabsTrigger>
              <TabsTrigger value="reverse">
                Exchanges &amp; Returns{reverseNeedsAction ? ` (${reverseNeedsAction})` : ''}
              </TabsTrigger>
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

          <TabsContent value="tracker" className="mt-0">
            <ShipmentList variant="forward" shipments={forward} {...listProps} />
          </TabsContent>

          <TabsContent value="reverse" className="mt-0">
            <ShipmentList variant="reverse" shipments={reverse} {...listProps} />
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
                    {selected.raised_date && <span>· Raised {formatDay(selected.raised_date)}</span>}
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
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader className="text-left">
              <SheetTitle>Add shipment</SheetTitle>
              <SheetDescription>For orders, exchanges or returns that don't come in from Shopify.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">
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
            </div>
          </SheetContent>
        </Sheet>

        {isAdmin && <ShipmentSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} />}
        <ImportTrackerDialog open={importOpen} onOpenChange={setImportOpen} />
      </div>
    </Layout>
  );
}
