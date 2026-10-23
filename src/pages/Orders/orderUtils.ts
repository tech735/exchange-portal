import { differenceInCalendarDays } from 'date-fns';
import type { ShopifyOrder } from '@/services/shopify';
import type { Tone } from '@/lib/exchangeStatus';
import { formatINR } from '@/components/app';

/**
 * Shopify's REST order payload carries more fields than `ShopifyOrder` declares.
 * These are the extra ones this page reads (all optional — older cached payloads may lack them).
 */
type Fulfillment = NonNullable<ShopifyOrder['fulfillments']>[number] & {
  shipment_status?: string | null;
  updated_at?: string;
};

export type OrderRecord = Omit<ShopifyOrder, 'fulfillments'> & {
  cancelled_at?: string | null;
  order_status_url?: string | null;
  fulfillments?: Fulfillment[];
};

export interface Pill {
  label: string;
  tone: Tone;
}

export interface Eligibility extends Pill {
  eligible: boolean;
  /** Long form for the order panel, e.g. "Eligible · 9 days left". */
  longLabel: string;
  daysLeft: number;
  /** Why the exchange cannot be started (only when !eligible). */
  reason?: string;
}

const titleCase = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function customerName(o: OrderRecord) {
  const name = [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(' ').trim();
  if (name) return name;
  const ship = [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(' ').trim();
  return ship || o.email || 'Guest';
}

export const customerEmail = (o: OrderRecord) => o.email || o.customer?.email || '';
export const customerPhone = (o: OrderRecord) => o.phone || o.customer?.phone || o.shipping_address?.phone || '';

export const itemCount = (o: OrderRecord) => o.line_items.reduce((s, i) => s + i.quantity, 0);

/** Order number without the leading "#", used for /exchanges/new?order=… */
export const orderNumber = (o: OrderRecord) => (o.name || String(o.id)).replace(/^#/, '');

export function money(amount: string | number | null | undefined, currency?: string) {
  const n = Number(amount || 0);
  if (!currency || currency === 'INR') return formatINR(n);
  return `${currency} ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function paymentPill(o: OrderRecord): Pill {
  const s = (o.financial_status || '').toLowerCase();
  switch (s) {
    case 'paid':
      return { label: 'Paid', tone: 'success' };
    case 'pending':
    case 'authorized':
    case 'partially_paid':
      return { label: titleCase(s), tone: 'warning' };
    case 'partially_refunded':
      return { label: 'Partially refunded', tone: 'warning' };
    case 'refunded':
      return { label: 'Refunded', tone: 'neutral' };
    case 'voided':
      return { label: 'Voided', tone: 'neutral' };
    case '':
      return { label: 'Unknown', tone: 'neutral' };
    default:
      return { label: titleCase(s), tone: 'neutral' };
  }
}

/** The fulfillment marked delivered by the carrier, if any. */
function deliveredFulfillment(o: OrderRecord) {
  return o.fulfillments?.find((f) => f.shipment_status === 'delivered');
}

/** Best-known delivery date (carrier "delivered" event), else null. */
export function deliveredAt(o: OrderRecord): Date | null {
  const f = deliveredFulfillment(o);
  const at = f?.updated_at || f?.created_at;
  return at ? new Date(at) : null;
}

/** Most recent shipment created for the order, else null. */
export function fulfilledAt(o: OrderRecord): Date | null {
  const dates = (o.fulfillments ?? []).map((f) => f.created_at).filter(Boolean) as string[];
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return new Date(sorted[sorted.length - 1]);
}

export function fulfillmentPill(o: OrderRecord): Pill {
  if (o.cancelled_at) return { label: 'Cancelled', tone: 'neutral' };
  const s = (o.fulfillment_status || '').toLowerCase();
  if (s === 'fulfilled') {
    if (deliveredFulfillment(o)) return { label: 'Delivered', tone: 'success' };
    const inTransit = o.fulfillments?.some((f) =>
      ['in_transit', 'out_for_delivery', 'confirmed', 'label_printed', 'label_purchased'].includes(f.shipment_status || ''),
    );
    return inTransit ? { label: 'In transit', tone: 'info' } : { label: 'Fulfilled', tone: 'info' };
  }
  if (s === 'partial') return { label: 'Partial', tone: 'warning' };
  if (s === 'restocked') return { label: 'Restocked', tone: 'neutral' };
  if (!s) return { label: 'Unfulfilled', tone: 'warning' };
  return { label: titleCase(s), tone: 'neutral' };
}

/**
 * Exchange window: counted from delivery (or shipment, or the order date as a fallback)
 * against `exchange_policy.window_days`.
 */
export function eligibility(o: OrderRecord, windowDays: number, now: Date = new Date()): Eligibility {
  if (o.cancelled_at) {
    return { eligible: false, label: 'Cancelled', longLabel: 'Order cancelled', tone: 'neutral', daysLeft: 0, reason: 'This order was cancelled in Shopify.' };
  }
  const base = deliveredAt(o) ?? fulfilledAt(o) ?? new Date(o.created_at);
  const daysLeft = windowDays - differenceInCalendarDays(now, base);
  if (daysLeft < 0) {
    return {
      eligible: false,
      label: 'Window closed',
      longLabel: 'Window closed',
      tone: 'neutral',
      daysLeft,
      reason: `The ${windowDays}-day exchange window closed ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago.`,
    };
  }
  if (daysLeft === 0) {
    return { eligible: true, label: 'Eligible · last day', longLabel: 'Eligible · last day', tone: 'success', daysLeft };
  }
  return {
    eligible: true,
    label: `Eligible · ${daysLeft}d left`,
    longLabel: `Eligible · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
    tone: 'success',
    daysLeft,
  };
}

/** Shopify admin link, derived from the store host in the customer-facing status URL. */
export function shopifyAdminUrl(o: OrderRecord): string | null {
  if (!o.order_status_url) return null;
  try {
    return `${new URL(o.order_status_url).origin}/admin/orders/${o.id}`;
  } catch {
    return null;
  }
}

export function shipTo(o: OrderRecord): string | null {
  const a = o.shipping_address;
  if (!a) return null;
  const parts = [a.address1, a.address2, a.city, [a.province, a.zip].filter(Boolean).join(' ')].filter((p) => p && String(p).trim());
  return parts.length ? parts.join(', ') : null;
}

export function matchesSearch(o: OrderRecord, q: string) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, '');
  const hay = [o.name, o.email, o.customer?.email, o.customer?.first_name, o.customer?.last_name, customerName(o)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (hay.includes(needle)) return true;
  if (digits.length >= 3) {
    const phones = [o.phone, o.customer?.phone, o.shipping_address?.phone].filter(Boolean).join(' ').replace(/\D/g, '');
    if (phones.includes(digits)) return true;
  }
  return false;
}

export function relativeTime(ts: number, now: number) {
  if (!ts) return 'not yet';
  const mins = Math.floor((now - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
