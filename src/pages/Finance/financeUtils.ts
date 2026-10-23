import { differenceInCalendarDays, format, isSameMonth } from 'date-fns';
import type { Ticket, TicketItem, TicketStage } from '@/types/database';
import { EXCHANGE_STATUS_LABELS, getExchangeStatus } from '@/lib/exchangeStatus';

export type FinanceTab = 'to-invoice' | 'refunds' | 'invoiced' | 'completed';

/** Stages finance still has to act on. Small set, fetched on its own so it is never truncated. */
export const ACTIVE_FINANCE_STAGES: TicketStage[] = [
  'EXCHANGE_BOOKED',
  'EXCHANGE_COMPLETED',
  'INVOICING_PENDING',
  'INVOICED',
  'TO_BE_REFUNDED',
];

const TO_INVOICE_STAGES = new Set<TicketStage>(['EXCHANGE_BOOKED', 'EXCHANGE_COMPLETED', 'INVOICING_PENDING']);

/** Same Zoho Books destination and sessionStorage key as the old Invoicing page. */
export const ZOHO_SALES_ORDERS_URL = 'https://books.zoho.in/app/852503254#/salesorders';
export const PROCESSING_STORAGE_KEY = 'processingInvoices';

export type PriceMap = Record<string, number> | undefined;

function isRefundDue(t: Ticket) {
  return getExchangeStatus(t).key === 'REFUND_DUE';
}

export function financeTabOf(t: Ticket): FinanceTab | null {
  if (TO_INVOICE_STAGES.has(t.stage)) return 'to-invoice';
  if (t.stage === 'CLOSED') return 'completed';
  if (t.stage === 'INVOICED' || t.stage === 'TO_BE_REFUNDED') return isRefundDue(t) ? 'refunds' : 'invoiced';
  return null;
}

/** Sum of price × qty. Uses the price captured on the item, then the catalogue price. Null when nothing is priced. */
export function itemsValue(items: TicketItem[], prices: PriceMap): number | null {
  let total = 0;
  let known = false;
  for (const it of items || []) {
    const p = it.price ?? prices?.[it.sku];
    if (p === undefined || p === null || Number.isNaN(Number(p))) continue;
    total += Number(p) * (Number(it.qty) || 0);
    known = true;
  }
  return known ? total : null;
}

export function shippedAt(t: Ticket): string | null {
  return t.exchange_booked_at ?? t.exchange_completed_at ?? null;
}

export function refundAgeDays(t: Ticket, now = new Date()): number {
  const base = t.invoicing_done_at ?? t.exchange_completed_at ?? t.updated_at;
  if (!base) return 0;
  return Math.max(0, differenceInCalendarDays(now, new Date(base)));
}

export function inThisMonth(iso: string | null | undefined, now = new Date()) {
  return !!iso && isSameMonth(new Date(iso), now);
}

export function shortDate(iso: string | null | undefined) {
  return iso ? format(new Date(iso), 'd MMM') : null;
}

export function matchesSearch(t: Ticket, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const digits = query.replace(/\D/g, '');
  return (
    t.order_id.toLowerCase().includes(query) ||
    t.customer_name.toLowerCase().includes(query) ||
    t.customer_phone.toLowerCase().includes(query) ||
    (digits.length >= 3 && t.customer_phone.replace(/\D/g, '').includes(digits))
  );
}

/* ------------------------------------------------------------------ */
/* CSV export for Zoho                                                 */
/* ------------------------------------------------------------------ */

function describeItems(items: TicketItem[]) {
  return (items || [])
    .map((i) => `${i.product_name}${i.size ? ` (${i.size})` : ''} x${i.qty}${i.sku ? ` [${i.sku}]` : ''}`)
    .join('; ');
}

function csvCell(v: string | number | null | undefined) {
  let s = v === null || v === undefined ? '' : String(v);
  // Block spreadsheet formula injection; keep leading + and - (phone numbers, amounts).
  if (/^[=@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const isoDate = (iso: string | null | undefined) => (iso ? format(new Date(iso), 'yyyy-MM-dd') : '');

export function downloadFinanceCSV(rows: Ticket[], prices: PriceMap, filename: string) {
  const headers = [
    'Order ID',
    'Customer Name',
    'Customer Phone',
    'Customer Email',
    'Exchange Items',
    'Return Items',
    'Exchange Value',
    'Amount Collected',
    'Refund Amount',
    'Refund Status',
    'Shipped / Booked Date',
    'Invoiced Date',
    'Refund Sent Date',
    'Status',
  ];
  const lines = rows.map((t) => {
    const value = itemsValue(t.exchange_items, prices);
    return [
      t.order_id,
      t.customer_name,
      t.customer_phone,
      t.customer_email ?? '',
      describeItems(t.exchange_items),
      describeItems(t.return_items),
      value === null ? '' : Math.round(value),
      Math.round(t.amount_collected || 0),
      Math.round(t.refund_amount || 0),
      t.refund_amount > 0 ? (t.refund_status === 'PROCESSED' ? 'Refunded' : 'Due') : '',
      isoDate(shippedAt(t)),
      isoDate(t.invoicing_done_at),
      isoDate(t.refund_sent_at),
      EXCHANGE_STATUS_LABELS[getExchangeStatus(t).key],
    ].map(csvCell).join(',');
  });
  const csv = '﻿' + [headers.map(csvCell).join(','), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
