// Reads a CSV download of the old "Ecom Order Tracker" Google Sheet so its
// history (pickup / delivered dates, who was notified, notes) moves into the
// shipments table. The sheet has a title, notes and a KPI block above the
// real header row, so parsing starts at the row whose first cell is
// "Order No.".
import type { ShipmentStatus } from '@/types/database';

export interface TrackerRow {
  shipment_ref: string;
  order_name: string;
  order_date: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  city: string | null;
  courier: string | null;
  awb_number: string | null;
  pickup_date: string | null;
  delivered_date: string | null;
  status: ShipmentStatus | null;
  customer_notified: boolean;
  notified_on: string | null;
  notes: string | null;
}

// RFC 4180-ish: quoted fields may contain commas, quotes ("") and newlines.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

// "01/Oct/2026" → "2026-10-01"; also accepts ISO dates.
export function parseSheetDate(value: string): string | null {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const match = v.match(/^(\d{1,2})[/\- ]([A-Za-z]{3})[A-Za-z]*[/\- ](\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  return month ? `${match[3]}-${month}-${match[1].padStart(2, '0')}` : null;
}

const STATUS_FROM_SHEET: Record<string, ShipmentStatus> = {
  'awaiting pickup': 'AWAITING_PICKUP',
  'picked up': 'PICKED_UP',
  'in transit': 'IN_TRANSIT',
  'out for delivery': 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  rto: 'RTO',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
};

const orNull = (value: string | undefined) => (value && value.trim() !== '' && value.trim() !== '-' ? value.trim() : null);

export function parseTrackerCsv(text: string): TrackerRow[] {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((r) => r[0]?.trim().toLowerCase() === 'order no.');
  if (headerIndex === -1) {
    throw new Error('Could not find the "Order No." header row — is this the Order Tracker sheet?');
  }

  const header = rows[headerIndex].map((h) => h.trim().toLowerCase());
  const col = (row: string[], name: string) => {
    const index = header.indexOf(name);
    return index === -1 ? undefined : row[index];
  };
  // The sheet's unnamed last column ("Column 19") holds free-text remarks.
  const notesIndex = header.findIndex((h) => h === 'notes' || h === 'remarks' || /^column \d+$/.test(h));

  return rows
    .slice(headerIndex + 1)
    .filter((r) => orNull(r[0]))
    .map((r) => {
      const ref = r[0].trim();
      return {
        shipment_ref: ref,
        // "-F1" style suffixes mark the fulfillment, not the Shopify order.
        order_name: ref.replace(/-F\d+$/i, ''),
        order_date: parseSheetDate(col(r, 'order date') ?? ''),
        customer_name: orNull(col(r, 'customer name')),
        customer_phone: orNull(col(r, 'phone')),
        customer_email: orNull(col(r, 'email')),
        city: orNull(col(r, 'city')),
        courier: orNull(col(r, 'courier')),
        awb_number: orNull(col(r, 'awb no.')),
        pickup_date: parseSheetDate(col(r, 'pickup date') ?? ''),
        delivered_date: parseSheetDate(col(r, 'delivered date') ?? ''),
        status: STATUS_FROM_SHEET[(col(r, 'shipment status') ?? '').trim().toLowerCase()] ?? null,
        customer_notified: (col(r, 'customer notified') ?? '').trim().toLowerCase() === 'yes',
        notified_on: parseSheetDate(col(r, 'notified on') ?? ''),
        notes: notesIndex === -1 ? null : orNull(r[notesIndex]),
      };
    });
}
