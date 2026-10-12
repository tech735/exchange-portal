/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// @ts-nocheck
// Live courier status for outbound shipments, straight from the logistics
// aggregator the parcel was booked through (iThink Logistics or ShipDelight).
// Used by the track-shipments Edge Function.
//
// The API calls follow the adapters on the feature/reverse-logistics-tms
// branch (_shared/logistics/ithinkAdapter.ts, shipdelightAdapter.ts), cut down
// to tracking only, with the courier's status mapped onto the tracker's
// forward statuses instead of the reverse-pickup ones.
//
// Secrets: ITHINK_API_BASE_URL, ITHINK_ACCESS_TOKEN, ITHINK_SECRET_KEY and/or
// SHIPDELIGHT_API_KEY (SHIPDELIGHT_API_BASE_URL optional).

export type Aggregator = 'ITHINK' | 'SHIPDELIGHT';

export const AGGREGATOR_LABELS: Record<Aggregator, string> = { ITHINK: 'iThink', SHIPDELIGHT: 'ShipDelight' };

export interface CourierTracking {
  aggregator: Aggregator;
  // The aggregator's own wording ("REV Picked Up", "UNDELIVERED" …), shown in the app.
  courierStatus: string;
  // Tracker status, or null when none fits (lost, damaged, unrecognised).
  status: string | null;
  pickupDate: string | null; // IST yyyy-MM-dd of the first scan after pickup
  deliveredDate: string | null;
}

const ITHINK_BASE_URL = Deno.env.get('ITHINK_API_BASE_URL');
const ITHINK_ACCESS_TOKEN = Deno.env.get('ITHINK_ACCESS_TOKEN');
const ITHINK_SECRET_KEY = Deno.env.get('ITHINK_SECRET_KEY');
const SHIPDELIGHT_BASE_URL = Deno.env.get('SHIPDELIGHT_API_BASE_URL') || 'https://appapi.shipdelight.com';
const SHIPDELIGHT_API_KEY = Deno.env.get('SHIPDELIGHT_API_KEY');

// docs.ithinklogistics.com/doc-track-order/3 takes a comma-separated list.
export const ITHINK_BATCH_SIZE = 10;

export const isConfigured = (aggregator: Aggregator) =>
  aggregator === 'ITHINK' ? !!(ITHINK_BASE_URL && ITHINK_ACCESS_TOKEN && ITHINK_SECRET_KEY) : !!SHIPDELIGHT_API_KEY;

// Best guess before the AWB has been found anywhere.
export function guessAggregator(shipment: { tracking_url?: string | null; courier?: string | null }): Aggregator | null {
  const text = `${shipment.tracking_url ?? ''} ${shipment.courier ?? ''}`.toLowerCase();
  if (text.includes('ithink')) return 'ITHINK';
  if (text.includes('shipdelight') || text.includes('instalogix')) return 'SHIPDELIGHT';
  return null;
}

const RANK: Record<string, number> = { AWAITING_PICKUP: 0, PICKED_UP: 1, IN_TRANSIT: 2, OUT_FOR_DELIVERY: 3, DELIVERED: 4 };

// Courier wording → tracker status. iThink sends text ("Manifested",
// "Picked Up", "Undelivered", "RTO In Transit" …); ShipDelight text comes
// from the status-code labels below. A failed delivery attempt is still with
// the courier, so it stays In Transit; every RTO stage is RTO.
export function trackerStatus(courierStatus: string | null | undefined): string | null {
  const s = String(courierStatus ?? '').toLowerCase();
  if (!s) return null;
  if (/\brto\b|return to origin/.test(s)) return 'RTO';
  if (s.includes('cancel')) return 'CANCELLED';
  if (/lost|damage|destroy|shortage/.test(s)) return null;
  if (s.includes('out for delivery')) return 'OUT_FOR_DELIVERY';
  if (/undeliver|not delivered|reattempt|unattempt|self ?collect/.test(s)) return 'IN_TRANSIT';
  if (s.includes('delivered')) return 'DELIVERED';
  if (/not picked|pending|out for pick|manifest|pickup scheduled|pickup generated|booked|label/.test(s)) return 'AWAITING_PICKUP';
  if (s.includes('picked') || s.includes('pickup done')) return 'PICKED_UP';
  if (/transit|reached|destination|hub|delay|misrout|dispatch|shipped|connected/.test(s)) return 'IN_TRANSIT';
  return null;
}

// Forward status codes from the InstaLogix (ShipDelight) "Status Events"
// table; anything else (RTO 6xx, cancelled 900, lost 901 …) falls back to the
// response's own text.
const SHIPDELIGHT_LABELS: Record<string, string> = {
  '99': 'PENDING PICKUP', '100': 'PICKUP DONE',
  '102': 'IN-TRANSIT', '105': 'IN-TRANSIT', '200': 'IN-TRANSIT', '201': 'IN-TRANSIT', '204': 'IN-TRANSIT',
  '211': 'IN-TRANSIT', '301': 'IN-TRANSIT', '312': 'IN-TRANSIT',
  '305': 'OUT FOR DELIVERY', '400': 'DELIVERED', '401': 'RTO DELIVERED',
  '600': 'RTO INITIATED', '601': 'RTO IN-TRANSIT', '620': 'RTO OUT FOR DELIVERY',
  '900': 'PICKUP CANCELLED', '901': 'LOST', '902': 'SHIPMENT DAMAGE',
  '951': 'REATTEMPT', '1001': 'UNATTEMPTED',
};
const shipDelightLabel = (code: unknown, text: unknown) => {
  const key = String(code ?? '');
  if (SHIPDELIGHT_LABELS[key]) return SHIPDELIGHT_LABELS[key];
  if (/^5\d\d$/.test(key)) return 'UNDELIVERED';
  return String(text ?? '') || key;
};

// Aggregator timestamps are IST wall-clock ("2026-10-12 14:05:00" or
// "12-10-2026 14:05"); one carrying a zone is converted to IST.
function istDay(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (/T.*(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    const date = new Date(text);
    if (!isNaN(date.getTime())) return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
  }
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

// Pickup = earliest scan at or past Picked Up; delivered = the delivered scan.
function scanDates(scans: { status: string | null; at: unknown }[]) {
  let pickupDate: string | null = null;
  let deliveredDate: string | null = null;
  for (const scan of scans) {
    const day = istDay(scan.at);
    if (!day || scan.status === null || !(scan.status in RANK)) continue;
    if (RANK[scan.status] >= RANK.PICKED_UP && (!pickupDate || day < pickupDate)) pickupDate = day;
    if (scan.status === 'DELIVERED' && (!deliveredDate || day > deliveredDate)) deliveredDate = day;
  }
  return { pickupDate, deliveredDate };
}

// POST {base}/order/track.json. Returns the AWBs iThink knows; throws if the
// call itself fails.
export async function trackIThink(awbs: string[]): Promise<Map<string, CourierTracking>> {
  const response = await fetch(`${ITHINK_BASE_URL}/order/track.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { awb_number_list: awbs.join(','), access_token: ITHINK_ACCESS_TOKEN, secret_key: ITHINK_SECRET_KEY },
    }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json) throw new Error(`iThink tracking failed (HTTP ${response.status})`);

  const found = new Map<string, CourierTracking>();
  for (const awb of awbs) {
    const entry = json.data?.[awb];
    if (!entry?.current_status) continue;
    const scans = (Array.isArray(entry.scan_details) ? entry.scan_details : []).map((e: any) => ({
      status: trackerStatus(e.status),
      at: e.scan_date_time,
    }));
    found.set(awb, {
      aggregator: 'ITHINK',
      courierStatus: entry.current_status,
      status: trackerStatus(entry.current_status),
      ...scanDates(scans),
    });
  }
  return found;
}

// ShipDelight's bearer token lasts 24h; cached per warm isolate.
let shipDelightToken: { token: string; expiresAt: number } | null = null;

async function shipDelightAuth(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (shipDelightToken && shipDelightToken.expiresAt - 300 > now) return shipDelightToken.token;
  const response = await fetch(
    `${SHIPDELIGHT_BASE_URL}/generate-token?api_key=${encodeURIComponent(SHIPDELIGHT_API_KEY)}`,
    { method: 'POST' },
  );
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.data?.access_token) {
    throw new Error(`ShipDelight token failed (HTTP ${response.status}): ${json?.message ?? 'no details'}`);
  }
  shipDelightToken = { token: json.data.access_token, expiresAt: json.data.expires_at };
  return shipDelightToken.token;
}

// POST {base}/tracking, one AWB per call. Null when ShipDelight doesn't know
// the AWB; throws if the call itself fails. The live response nests
// everything under data.response, unlike the documented flat shape, so both
// are read.
export async function trackShipDelight(awb: string): Promise<CourierTracking | null> {
  const response = await fetch(`${SHIPDELIGHT_BASE_URL}/tracking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await shipDelightAuth()}` },
    body: JSON.stringify({ filter_type: 'airwaybilno', filter_value: awb }),
  });
  if (response.status === 401 || response.status === 403 || response.status >= 500) {
    if (response.status === 401) shipDelightToken = null;
    throw new Error(`ShipDelight tracking failed (HTTP ${response.status})`);
  }
  const json = await response.json().catch(() => null);
  const list = Array.isArray(json?.tracking) ? json.tracking : json?.data?.response?.tracking;
  const entry = Array.isArray(list) ? list[0] : null;
  if (!entry?.latest_status_code) return null;

  const courierStatus = shipDelightLabel(entry.latest_status_code, entry.latest_status);
  const scans = (Array.isArray(entry.tracking_history) ? entry.tracking_history : []).map((e: any) => ({
    status: trackerStatus(shipDelightLabel(e.status_code, e.status)),
    at: e.updated_at,
  }));
  return { aggregator: 'SHIPDELIGHT', courierStatus, status: trackerStatus(courierStatus), ...scanDates(scans) };
}
