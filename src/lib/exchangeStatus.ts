import type { Ticket } from '@/types/database';

/**
 * One status everyone sees, derived from the stored `stage` + `status` + payment
 * fields. The database keeps its existing columns; this is a read-side mapping
 * only, so no migration touches live tickets.
 */
export type ExchangeStatusKey =
  | 'REQUESTED'          // lodged, nothing decided on payment yet
  | 'AWAITING_PAYMENT'   // payment link sent
  | 'TO_BOOK_PICKUP'     // paid / settled, return pickup not booked
  | 'RETURN_IN_TRANSIT'  // pickup booked
  | 'QC_PENDING'         // received at warehouse
  | 'READY_TO_SHIP'      // QC approved, replacement not booked
  | 'REJECTED'           // QC denied
  | 'SHIPPED'            // replacement booked / sent
  | 'INVOICING'          // waiting for invoice
  | 'REFUND_DUE'
  | 'CLOSED'
  | 'ESCALATED';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

export interface ExchangeStatus {
  key: ExchangeStatusKey;
  label: string;
  tone: Tone;
  /** 0-based index into EXCHANGE_STEPS for the stepper; -1 for side exits. */
  step: number;
  /** The single next action for staff, if any. */
  nextAction?: { label: string; team: 'support' | 'warehouse' | 'finance' };
}

export const EXCHANGE_STEPS = [
  'Requested',
  'Payment',
  'Return pickup',
  'Received & QC',
  'Replacement shipped',
  'Invoiced',
  'Closed',
] as const;

const def: Record<ExchangeStatusKey, Omit<ExchangeStatus, 'key'>> = {
  REQUESTED: { label: 'Requested', tone: 'info', step: 0, nextAction: { label: 'Collect payment', team: 'support' } },
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'warning', step: 1, nextAction: { label: 'Confirm payment', team: 'support' } },
  TO_BOOK_PICKUP: { label: 'To book pickup', tone: 'brand', step: 2, nextAction: { label: 'Book return pickup', team: 'warehouse' } },
  RETURN_IN_TRANSIT: { label: 'Return in transit', tone: 'info', step: 2, nextAction: { label: 'Mark received', team: 'warehouse' } },
  QC_PENDING: { label: 'QC pending', tone: 'warning', step: 3, nextAction: { label: 'Run QC', team: 'warehouse' } },
  READY_TO_SHIP: { label: 'Ready to ship', tone: 'brand', step: 3, nextAction: { label: 'Ship replacement', team: 'warehouse' } },
  REJECTED: { label: 'Rejected at QC', tone: 'danger', step: -1 },
  SHIPPED: { label: 'Replacement shipped', tone: 'success', step: 4, nextAction: { label: 'Invoice', team: 'finance' } },
  INVOICING: { label: 'Invoicing', tone: 'warning', step: 5, nextAction: { label: 'Mark invoiced', team: 'finance' } },
  REFUND_DUE: { label: 'Refund due', tone: 'warning', step: 5, nextAction: { label: 'Send refund', team: 'finance' } },
  CLOSED: { label: 'Closed', tone: 'neutral', step: 6 },
  ESCALATED: { label: 'Escalated', tone: 'danger', step: -1 },
};

export function getExchangeStatus(t: Pick<Ticket, 'stage' | 'status' | 'is_paid' | 'exchange_completed_at' | 'refund_amount' | 'refund_status'>): ExchangeStatus {
  const key = statusKey(t);
  return { key, ...def[key] };
}

function statusKey(t: Pick<Ticket, 'stage' | 'status' | 'is_paid' | 'exchange_completed_at' | 'refund_amount' | 'refund_status'>): ExchangeStatusKey {
  switch (t.stage) {
    case 'LODGED': {
      const settled = t.is_paid || !!t.exchange_completed_at;
      if (settled) return 'TO_BOOK_PICKUP';
      if (t.status === 'ESCALATED') return 'ESCALATED';
      return t.status === 'IN_PROCESS' ? 'AWAITING_PAYMENT' : 'REQUESTED';
    }
    case 'RETURN_PENDING': return 'RETURN_IN_TRANSIT';
    case 'RETURN_RECEIVED': return 'QC_PENDING';
    case 'WAREHOUSE_APPROVED': return 'READY_TO_SHIP';
    case 'WAREHOUSE_DENIED': return 'REJECTED';
    case 'EXCHANGE_BOOKED':
    case 'EXCHANGE_COMPLETED': return 'SHIPPED';
    case 'INVOICING_PENDING': return 'INVOICING';
    case 'INVOICED': return (t.refund_amount || 0) > 0 && t.refund_status !== 'PROCESSED' ? 'REFUND_DUE' : 'INVOICING';
    case 'TO_BE_REFUNDED': return 'REFUND_DUE';
    case 'CLOSED': return 'CLOSED';
    case 'ESCALATED': return 'ESCALATED';
    default: return 'REQUESTED';
  }
}

export const EXCHANGE_STATUS_LABELS = Object.fromEntries(
  Object.entries(def).map(([k, v]) => [k, v.label]),
) as Record<ExchangeStatusKey, string>;

/** Queues used for saved-view tabs, dashboard KPIs and the sidebar counts. */
export const EXCHANGE_QUEUES: { id: string; label: string; statuses: ExchangeStatusKey[] }[] = [
  { id: 'needs-payment', label: 'Needs payment', statuses: ['REQUESTED', 'AWAITING_PAYMENT'] },
  { id: 'to-book', label: 'To book pickup', statuses: ['TO_BOOK_PICKUP'] },
  { id: 'in-transit', label: 'Return in transit', statuses: ['RETURN_IN_TRANSIT'] },
  { id: 'qc', label: 'QC pending', statuses: ['QC_PENDING'] },
  { id: 'ready', label: 'Ready to ship', statuses: ['READY_TO_SHIP'] },
  { id: 'finance', label: 'Invoicing & refunds', statuses: ['SHIPPED', 'INVOICING', 'REFUND_DUE'] },
  { id: 'closed', label: 'Closed', statuses: ['CLOSED', 'REJECTED'] },
];

export const OPEN_STATUSES: ExchangeStatusKey[] = [
  'REQUESTED', 'AWAITING_PAYMENT', 'TO_BOOK_PICKUP', 'RETURN_IN_TRANSIT', 'QC_PENDING', 'READY_TO_SHIP', 'SHIPPED', 'INVOICING', 'REFUND_DUE', 'ESCALATED',
];

/** Where an exchange request came from. Stored in tickets.request_source. */
export type RequestSource = 'EMAIL' | 'WHATSAPP' | 'CALL' | 'HELPDESK' | 'OTHER';

export const REQUEST_SOURCE_LABELS: Record<RequestSource, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  CALL: 'Phone call',
  HELPDESK: 'Helpdesk ticket',
  OTHER: 'Other',
};

/** SLA target in hours from creation until the ticket leaves the current team. */
export function slaRemaining(t: Pick<Ticket, 'created_at' | 'sla_breached'>, now = Date.now()): { label: string; tone: Tone; hours: number } {
  if (t.sla_breached) return { label: 'SLA breached', tone: 'danger', hours: -1 };
  const ageH = (now - new Date(t.created_at).getTime()) / 36e5;
  const left = 48 - ageH; // 2-day first-response window, matches the escalate-tickets warning
  if (left <= 0) return { label: `Overdue ${formatHours(-left)}`, tone: 'danger', hours: left };
  if (left <= 8) return { label: `${formatHours(left)} left`, tone: 'warning', hours: left };
  return { label: `${formatHours(left)} left`, tone: 'neutral', hours: left };
}

function formatHours(h: number) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`;
}
