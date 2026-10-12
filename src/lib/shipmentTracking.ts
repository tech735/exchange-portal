// Shipment tracker logic for the UI. The deadline rules themselves live in
// supabase/functions/_shared/shipmentRules.ts so the shipment-alerts Edge
// Function applies exactly the same checks; this file adds the dashboard
// numbers and reports on top.
import { format, parseISO } from 'date-fns';
import {
  trackShipment,
  type IstNow,
  type ShipmentSettings,
  type ShipmentTracking,
} from '../../supabase/functions/_shared/shipmentRules';
import type { DeliveryZone, Shipment } from '@/types/database';

export {
  DEFAULT_SHIPMENT_SETTINGS,
  DELIVERY_CHECK_LABELS,
  istNow,
  trackShipment,
  type DeliveryCheck,
  type IstNow,
  type ShipmentSettings,
} from '../../supabase/functions/_shared/shipmentRules';

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
    todaysOrders: shipments.filter((s) => s.order_date === today).length,
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

// The two status lines at the top of the sheet.
export function dailySummary(stats: ShipmentStats, today: string) {
  const day = formatDay(today, 'd MMM');
  const delayed = stats.delayedNotify + stats.delayedNotified + stats.escalated;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const delivery =
    delayed === 0
      ? { ok: true, text: `${day}: no delivery delays – all within deadline` }
      : {
          ok: false,
          text:
            `${day}: ${plural(delayed, 'shipment')} past the delivery deadline` +
            (stats.delayedNotify ? ` – ${plural(stats.delayedNotify, 'customer')} still to notify` : '') +
            (stats.escalated ? ` – ${stats.escalated} escalated for RTO review` : ''),
        };

  const pickup =
    stats.pickupDelayed === 0
      ? { ok: true, text: 'Pickups: no pickup delays' }
      : { ok: false, text: `Pickups: ${plural(stats.pickupDelayed, 'order')} not picked up by the deadline` };

  return [delivery, pickup];
}

export interface DailyReportRow {
  date: string;
  placed: number;
  pickedUp: number;
  pickedUpLate: number;
  delivered: number;
  deliveredOnTime: number;
  deliveredLate: number;
}

// Orders placed, picked up and delivered on each day, newest first.
export function dailyReport(shipments: TrackedShipment[], sinceDate: string | null): DailyReportRow[] {
  const rows = new Map<string, DailyReportRow>();
  const row = (date: string) => {
    if (!rows.has(date)) {
      rows.set(date, { date, placed: 0, pickedUp: 0, pickedUpLate: 0, delivered: 0, deliveredOnTime: 0, deliveredLate: 0 });
    }
    return rows.get(date)!;
  };

  for (const s of shipments) {
    if (s.check === 'CANCELLED') continue;
    row(s.order_date).placed++;
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
