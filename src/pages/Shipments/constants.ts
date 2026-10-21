import type { Tone } from '@/lib/exchangeStatus';
import type { DeliveryCheck } from '@/lib/shipmentTracking';

// Tone + a short label for the check badge, stat pills and filter chips. The
// long label (DELIVERY_CHECK_LABELS) stays as the tooltip and in the filter menu.
export const CHECK_META: Record<DeliveryCheck, { tone: Tone; short: string }> = {
  ESCALATED: { tone: 'danger', short: 'RTO review' },
  DELAYED_NOTIFY: { tone: 'danger', short: 'Notify now' },
  PICKUP_DELAYED: { tone: 'warning', short: 'Pickup late' },
  DELAYED_NOTIFIED: { tone: 'warning', short: 'Notified' },
  AWAITING_PICKUP: { tone: 'neutral', short: 'Awaiting pickup' },
  ON_TRACK: { tone: 'success', short: 'On track' },
  DELIVERED_ON_TIME: { tone: 'success', short: 'On time' },
  DELIVERED_LATE: { tone: 'warning', short: 'Delivered late' },
  RTO: { tone: 'danger', short: 'RTO' },
  CANCELLED: { tone: 'neutral', short: 'Cancelled' },
};

export const DEFAULT_LOOKBACK_DAYS = 30;

export const LOOKBACK_LABELS: Record<string, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  all: 'All time',
};
