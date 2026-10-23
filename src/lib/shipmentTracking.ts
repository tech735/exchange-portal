// Shipment tracker logic for the UI. The deadline rules themselves live in
// supabase/functions/_shared/shipmentRules.ts so the shipment-alerts Edge
// Function applies exactly the same checks; this file adds the dashboard
// numbers and reports on top.
import { format, parseISO } from 'date-fns';
import {
  shipmentKind,
  trackShipment,
  type IstNow,
  type ShipmentSettings,
  type ShipmentTracking,
} from '../../supabase/functions/_shared/shipmentRules';
import { SHIPMENT_STATUS_LABELS, type DeliveryZone, type Shipment, type ShipmentStatus } from '@/types/database';

export {
  DEFAULT_SHIPMENT_SETTINGS,
  DELIVERY_CHECK_LABELS,
  SHIPMENT_KIND_LABELS,
  istNow,
  shipmentKind,
  trackShipment,
  type DeliveryCheck,
  type IstNow,
  type ShipmentKind,
  type ShipmentSettings,
} from '../../supabase/functions/_shared/shipmentRules';

// The day an exchange / return was raised; the order date for everything else.
export const raisedOn = (s: Shipment) => s.raised_date ?? s.order_date;

// Statuses a shipment can be set to; a return has no RTO.
export function statusOptions(shipmentRef: string | undefined): [ShipmentStatus, string][] {
  return (Object.entries(SHIPMENT_STATUS_LABELS) as [ShipmentStatus, string][]).filter(
    ([status]) => status !== 'RTO' || shipmentKind(shipmentRef) !== 'RETURN'
  );
}

export type TrackedShipment = Shipment & ShipmentTracking;

export const toDateInput = (date: Date) => format(date, 'yyyy-MM-dd');

export const formatDay = (value: string | null, pattern = 'dd MMM') =>
  value ? format(parseISO(value), pattern) : '—';

export function trackShipments(shipments: Shipment[], settings: ShipmentSettings, now: IstNow): TrackedShipment[] {
  return shipments.map((s) => ({ ...s, ...trackShipment(s, settings, now) }));
}

const isDelivered = (s: TrackedShipment) => s.check === 'DELIVERED_ON_TIME' || s.check === 'DELIVERED_LATE';

export interface ShipmentStats {
  total: number;
  todaysOrders: number;
  awaitingPickup: number;
  pickupDelayed: number;
  onTrack: number;
  outForDelivery: number;
  delayedNotify: number;
  delayedNotified: number;
  escalated: number;
  deliveredOnTime: number;
  deliveredLate: number;
  delivered: number;
  rto: number;
  onTimePercent: number | null;
  avgDaysNcr: number | null;
  avgDaysOutside: number | null;
}

const average = (values: number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

export function summarizeShipments(shipments: TrackedShipment[], today: string): ShipmentStats {
  const count = (check: TrackedShipment['check']) => shipments.filter((s) => s.check === check).length;
  const delivered = shipments.filter(isDelivered);
  const transitDays = (zone: DeliveryZone) =>
    delivered.filter((s) => s.delivery_zone === zone && s.daysInTransit !== null).map((s) => s.daysInTransit!);

  return {
    total: shipments.filter((s) => s.check !== 'CANCELLED').length,
    todaysOrders: shipments.filter((s) => raisedOn(s) === today).length,
    awaitingPickup: count('AWAITING_PICKUP'),
    pickupDelayed: count('PICKUP_DELAYED'),
    onTrack: count('ON_TRACK'),
    outForDelivery: shipments.filter((s) => s.status === 'OUT_FOR_DELIVERY').length,
    delayedNotify: count('DELAYED_NOTIFY'),
    delayedNotified: count('DELAYED_NOTIFIED'),
    escalated: count('ESCALATED'),
    deliveredOnTime: count('DELIVERED_ON_TIME'),
    deliveredLate: count('DELIVERED_LATE'),
    delivered: delivered.length,
    rto: count('RTO'),
    onTimePercent: delivered.length ? Math.round((count('DELIVERED_ON_TIME') / delivered.length) * 100) : null,
    avgDaysNcr: average(transitDays('DELHI_NCR')),
    avgDaysOutside: average(transitDays('OUTSIDE_NCR')),
  };
}

export interface DailyReportRow {
  date: string;
  placed: number;
  pickedUp: number;
  pickedUpLate: number;
  delivered: number;
  deliveredOnTime: number;
  deliveredLate: number;
  returns: number;
}

// Orders placed, picked up and delivered on each day, newest first. Returns
// are only counted as raised (the returns column), not as orders.
export function dailyReport(shipments: TrackedShipment[], sinceDate: string | null): DailyReportRow[] {
  const rows = new Map<string, DailyReportRow>();
  const row = (date: string) => {
    if (!rows.has(date)) {
      rows.set(date, { date, placed: 0, pickedUp: 0, pickedUpLate: 0, delivered: 0, deliveredOnTime: 0, deliveredLate: 0, returns: 0 });
    }
    return rows.get(date)!;
  };

  for (const s of shipments) {
    if (s.check === 'CANCELLED') continue;
    if (shipmentKind(s.shipment_ref) === 'RETURN') {
      row(raisedOn(s)).returns++;
      continue;
    }
    row(raisedOn(s)).placed++;
    if (s.pickup_date) {
      const r = row(s.pickup_date);
      r.pickedUp++;
      if (s.pickedUpLate) r.pickedUpLate++;
    }
    if (isDelivered(s) && s.delivered_date) {
      const r = row(s.delivered_date);
      r.delivered++;
      if (s.check === 'DELIVERED_LATE') r.deliveredLate++;
      else r.deliveredOnTime++;
    }
  }

  return [...rows.values()]
    .filter((r) => !sinceDate || r.date >= sinceDate)
    .sort((a, b) => b.date.localeCompare(a.date));
}
