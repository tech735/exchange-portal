// Delivery deadline rules for the shipment tracker, shared by the Shipments
// page (imported via src/lib/shipmentTracking.ts) and the shipment-alerts
// Edge Function, so the UI and the alerts can never disagree about what is
// late. Dependency-free on purpose: it runs in both the browser and Deno.
//
// Dates are 'yyyy-MM-dd' strings in IST, matching the DATE columns.
//   - Pickup is due by `pickup_deadline_hour` (1 PM) `pickup_deadline_days`
//     (1) day after the order is placed.
//   - Delivery is due `ncr_delivery_days` (2) / `outside_ncr_delivery_days`
//     (4) days after pickup; a courier-promised date on the shipment wins.
//   - With `skip_sundays`, Sundays are not counted towards either deadline.
//   - Undelivered `rto_escalation_days` (3) days past the delivery deadline,
//     a shipment is escalated for an RTO decision; RTO itself is set by hand or
//     by the courier tracking (track-shipments).

export interface ShipmentSettings {
  ncr_delivery_days: number;
  outside_ncr_delivery_days: number;
  pickup_deadline_days: number;
  pickup_deadline_hour: number;
  skip_sundays: boolean;
  rto_escalation_days: number;
  ncr_cities: string[];
  ncr_pincode_prefixes: string[];
  team_alert_emails: string[];
  notify_customers_by_email: boolean;
  notify_customers_by_sms: boolean;
}

export const DEFAULT_SHIPMENT_SETTINGS: ShipmentSettings = {
  ncr_delivery_days: 2,
  outside_ncr_delivery_days: 4,
  pickup_deadline_days: 1,
  pickup_deadline_hour: 13,
  skip_sundays: true,
  rto_escalation_days: 3,
  ncr_cities: ['delhi', 'gurgaon', 'gurugram', 'noida', 'greater noida', 'ghaziabad', 'faridabad'],
  ncr_pincode_prefixes: ['110', '1220', '1210', '2010', '2013'],
  team_alert_emails: [],
  notify_customers_by_email: false,
  notify_customers_by_sms: false,
};

export type DeliveryCheck =
  | 'AWAITING_PICKUP'
  | 'PICKUP_DELAYED'
  | 'ON_TRACK'
  | 'DELAYED_NOTIFY'
  | 'DELAYED_NOTIFIED'
  | 'ESCALATED'
  | 'DELIVERED_ON_TIME'
  | 'DELIVERED_LATE'
  | 'RTO'
  | 'CANCELLED';

export const DELIVERY_CHECK_LABELS: Record<DeliveryCheck, string> = {
  AWAITING_PICKUP: 'Awaiting Pickup',
  PICKUP_DELAYED: 'Pickup Delayed',
  ON_TRACK: 'On Track',
  DELAYED_NOTIFY: 'Delayed – Notify Now',
  DELAYED_NOTIFIED: 'Delayed – Notified',
  ESCALATED: 'Escalated – RTO Review',
  DELIVERED_ON_TIME: 'Delivered On Time',
  DELIVERED_LATE: 'Delivered Late',
  RTO: 'RTO',
  CANCELLED: 'Cancelled',
};

// The fields the rules read; Shipment rows from either side satisfy it.
export interface ShipmentDates {
  order_date: string;
  pickup_date: string | null;
  expected_delivery_date: string | null;
  delivered_date: string | null;
  status: string;
  delivery_zone: 'DELHI_NCR' | 'OUTSIDE_NCR';
  customer_notified: boolean;
}

export interface ShipmentTracking {
  check: DeliveryCheck;
  pickupDue: string;
  pickedUpLate: boolean;
  expectedDelivery: string | null;
  daysInTransit: number | null;
  daysDelayed: number | null;
  needsAction: boolean;
}

export interface IstNow {
  date: string;
  hour: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (time: number) => new Date(time).toISOString().slice(0, 10);

export const diffDays = (later: string, earlier: string) => Math.round((toUtc(later) - toUtc(earlier)) / DAY_MS);

export function addDeadlineDays(date: string, days: number, skipSundays: boolean): string {
  let time = toUtc(date);
  let counted = 0;
  while (counted < days) {
    time += DAY_MS;
    if (!skipSundays || new Date(time).getUTCDay() !== 0) counted++;
  }
  return fromUtc(time);
}

export function istNow(at: Date = new Date()): IstNow {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

export function trackShipment(
  shipment: ShipmentDates,
  settings: ShipmentSettings,
  now: IstNow = istNow()
): ShipmentTracking {
  const pickupDue = addDeadlineDays(shipment.order_date, settings.pickup_deadline_days, settings.skip_sundays);
  // Status says it left but nobody recorded when: count from the order date,
  // which can only flag a delay early, never hide one.
  const pickedUp = shipment.pickup_date ?? (shipment.status !== 'AWAITING_PICKUP' ? shipment.order_date : null);
  const delivered = shipment.status === 'DELIVERED' ? shipment.delivered_date ?? now.date : null;

  const zoneDays =
    shipment.delivery_zone === 'DELHI_NCR' ? settings.ncr_delivery_days : settings.outside_ncr_delivery_days;
  const expectedDelivery =
    shipment.expected_delivery_date ?? (pickedUp ? addDeadlineDays(pickedUp, zoneDays, settings.skip_sundays) : null);

  const daysInTransit = pickedUp ? Math.max(0, diffDays(delivered ?? now.date, pickedUp)) : null;
  const pickedUpLate = !!shipment.pickup_date && shipment.pickup_date > pickupDue;

  let check: DeliveryCheck;
  let daysDelayed: number | null = null;

  if (shipment.status === 'CANCELLED') {
    check = 'CANCELLED';
  } else if (shipment.status === 'RTO') {
    check = 'RTO';
  } else if (delivered) {
    const late = expectedDelivery ? diffDays(delivered, expectedDelivery) : 0;
    check = late > 0 ? 'DELIVERED_LATE' : 'DELIVERED_ON_TIME';
    daysDelayed = late > 0 ? late : null;
  } else if (!pickedUp) {
    const overdue =
      now.date > pickupDue || (now.date === pickupDue && now.hour >= settings.pickup_deadline_hour);
    check = overdue ? 'PICKUP_DELAYED' : 'AWAITING_PICKUP';
    daysDelayed = overdue ? diffDays(now.date, pickupDue) : null;
  } else if (expectedDelivery && now.date > expectedDelivery) {
    daysDelayed = diffDays(now.date, expectedDelivery);
    check =
      daysDelayed >= settings.rto_escalation_days
        ? 'ESCALATED'
        : shipment.customer_notified
          ? 'DELAYED_NOTIFIED'
          : 'DELAYED_NOTIFY';
  } else {
    check = 'ON_TRACK';
  }

  return {
    check,
    pickupDue,
    pickedUpLate,
    expectedDelivery,
    daysInTransit,
    daysDelayed,
    needsAction: check === 'DELAYED_NOTIFY' || check === 'PICKUP_DELAYED' || check === 'ESCALATED',
  };
}
