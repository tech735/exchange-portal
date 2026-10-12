/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// @ts-nocheck
// Shopify → public.order_shipments sync (action: syncShipments).
//
// Each Shopify fulfillment is one shipment row; an order with no fulfillment
// yet gets a '<order_id>:pending' placeholder so it is tracked from the day it
// is placed. Shopify owns the order/customer/courier fields, but anything the
// team edited by hand (listed in manual_overrides) is left alone, dates are
// only filled when empty, and status only ever moves forward. RTO is never
// set here; the team marks it in the tracker.
//
// A new fulfillment starts as Awaiting Pickup; from there the track-shipments
// function follows the parcel at iThink / ShipDelight every 10 minutes.
//
// Fulfilled shipments are named the way Shopify numbers fulfillments:
// <order>-F1, <order>-F2 ... (a cancelled fulfillment still uses up its number).
//
// Rows imported from the old Google Sheet (source MANUAL, no Shopify id) are
// adopted by order name the first time their order comes through, so an
// import followed by a sync never produces duplicates.

const API_VERSION = '2024-01';
const DEFAULT_LOOKBACK_DAYS = 30;
// Delivered dates come from one events call per fulfillment; during a long
// backfill, older orders fall back to the fulfillment's updated_at instead so
// the run stays inside the Edge Function time limit.
const DELIVERY_EVENT_LOOKUP_DAYS = 30;
const CHUNK = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

const ORDER_FIELDS = [
    'id', 'name', 'created_at', 'cancelled_at', 'email', 'phone',
    'customer', 'shipping_address', 'fulfillments',
].join(',');

// Forward-only ordering; terminal states share the top rank so the sync never
// flips a Delivered shipment to RTO or back again.
const STATUS_RANK: Record<string, number> = {
    AWAITING_PICKUP: 0,
    PICKED_UP: 1,
    IN_TRANSIT: 2,
    OUT_FOR_DELIVERY: 3,
    DELIVERED: 4,
    RTO: 4,
    CANCELLED: 4,
};

// Fields Shopify refreshes on every sync unless the team overrode them.
const SHOPIFY_OWNED_FIELDS = [
    'order_name', 'shipment_ref', 'order_date', 'customer_name', 'customer_phone',
    'customer_email', 'city', 'state', 'pincode', 'courier', 'awb_number', 'tracking_url',
];

function istDate(timestamp: string | null | undefined): string | null {
    if (!timestamp) return null;
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(timestamp));
}

// Shopify's fulfillment.shipment_status → our status. A fulfillment with no
// carrier status is packed but not yet collected; the aggregator's tracking
// (track-shipments) moves it on once the courier scans it.
function mapShipmentStatus(shipmentStatus: string | null): string {
    switch (shipmentStatus) {
        case 'delivered':
            return 'DELIVERED';
        case 'out_for_delivery':
            return 'OUT_FOR_DELIVERY';
        case 'in_transit':
        case 'attempted_delivery':
        case 'ready_for_pickup':
        case 'delayed':
        case 'failure':
            return 'IN_TRANSIT';
        default:
            return 'AWAITING_PICKUP';
    }
}

// Shopify's fulfillment name is '<order>.<n>'; fall back to its position
// among the order's fulfillments (oldest first) if that is missing.
function fulfillmentNumber(fulfillment: any, allFulfillments: any[]): number {
    const fromName = String(fulfillment.name ?? '').match(/\.(\d+)$/);
    if (fromName) return Number(fromName[1]);
    const ordered = [...allFulfillments].sort(
        (a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id
    );
    return ordered.findIndex((f) => f.id === fulfillment.id) + 1;
}

async function shopifyGet(url: string, accessToken: string) {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    });
    if (!response.ok) {
        throw new Error(`Shopify API error ${response.status}: ${await response.text()}`);
    }
    const next = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    return { data: await response.json(), next };
}

async function fetchOrdersSince(storeUrl: string, accessToken: string, sinceIso: string): Promise<any[]> {
    const orders: any[] = [];
    let url: string | null =
        `https://${storeUrl}/admin/api/${API_VERSION}/orders.json?status=any&limit=250` +
        `&created_at_min=${encodeURIComponent(sinceIso)}&fields=${ORDER_FIELDS}`;

    while (url) {
        const { data, next } = await shopifyGet(url, accessToken);
        orders.push(...(data.orders || []));
        url = next;
    }
    return orders;
}

// The delivered event carries the real delivery time; the fulfillment's
// updated_at is only a fallback.
async function fetchDeliveredDate(storeUrl: string, accessToken: string, orderId: number, fulfillment: any) {
    try {
        const { data } = await shopifyGet(
            `https://${storeUrl}/admin/api/${API_VERSION}/orders/${orderId}/fulfillments/${fulfillment.id}/events.json`,
            accessToken,
        );
        const delivered = (data.fulfillment_events || []).find((e: any) => e.status === 'delivered');
        if (delivered?.happened_at) return istDate(delivered.happened_at);
    } catch (error) {
        console.error(`Could not load fulfillment events for ${fulfillment.id}:`, error.message);
    }
    return istDate(fulfillment.updated_at);
}

function orderFields(order: any) {
    const address = order.shipping_address || {};
    const customer = order.customer || {};
    const name =
        address.name ||
        [address.first_name, address.last_name].filter(Boolean).join(' ') ||
        [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
        null;

    return {
        order_name: order.name,
        order_date: istDate(order.created_at),
        customer_name: name,
        customer_phone: address.phone || order.phone || customer.phone || null,
        customer_email: order.email || customer.email || null,
        city: address.city || null,
        state: address.province || null,
        pincode: address.zip || null,
    };
}

// Every column, so all rows in one upsert batch carry the same keys.
function newRow(key: string, order: any, now: string) {
    return {
        id: crypto.randomUUID(),
        shipment_key: key,
        source: 'SHOPIFY',
        shopify_order_id: order.id,
        shopify_fulfillment_id: null,
        order_name: order.name,
        shipment_ref: order.name,
        order_date: istDate(order.created_at),
        customer_name: null,
        customer_phone: null,
        customer_email: null,
        city: null,
        state: null,
        pincode: null,
        delivery_zone: 'OUTSIDE_NCR', // recomputed by the table trigger
        courier: null,
        awb_number: null,
        tracking_url: null,
        status: 'AWAITING_PICKUP',
        courier_status: null,
        pickup_date: null,
        expected_delivery_date: null,
        delivered_date: null,
        customer_notified: false,
        notified_on: null,
        notified_via: null,
        notes: null,
        resolution: null,
        resolved_on: null,
        pickup_alert_sent_at: null,
        delay_alert_sent_at: null,
        escalation_alert_sent_at: null,
        manual_overrides: [],
        aggregator: null,
        tracking_error: null,
        tracking_error_at: null,
        last_synced_at: null,
        created_at: now,
        updated_at: now,
    };
}

// Apply Shopify's view of a shipment onto a row without clobbering edits.
function merge(row: any, incoming: Record<string, any>, now: string) {
    const locked = new Set(row.manual_overrides || []);
    const next = { ...row, last_synced_at: now };

    for (const field of SHOPIFY_OWNED_FIELDS) {
        if (locked.has(field) || !(field in incoming)) continue;
        // Don't blank a value Shopify simply doesn't have (e.g. no AWB yet).
        if (incoming[field] === null && row[field] !== null) continue;
        next[field] = incoming[field];
    }

    // Once the aggregator has the AWB, its status is the more current one.
    if ('courier_status' in incoming && !row.aggregator) next.courier_status = incoming.courier_status;
    if ('shopify_fulfillment_id' in incoming) next.shopify_fulfillment_id = incoming.shopify_fulfillment_id;

    if (incoming.status && STATUS_RANK[incoming.status] > STATUS_RANK[row.status]) {
        next.status = incoming.status;
    }
    if (!row.pickup_date && incoming.pickup_date && STATUS_RANK[next.status] >= STATUS_RANK.PICKED_UP && next.status !== 'CANCELLED') {
        next.pickup_date = incoming.pickup_date;
    }
    if (!row.delivered_date && incoming.delivered_date && next.status === 'DELIVERED') {
        next.delivered_date = incoming.delivered_date;
    }
    return next;
}

export async function syncShipments({ supabaseAdmin, storeUrl, accessToken, lookbackDays }) {
    const days = Number(lookbackDays) > 0 ? Number(lookbackDays) : DEFAULT_LOOKBACK_DAYS;
    const since = new Date(Date.now() - days * DAY_MS).toISOString();
    const eventCutoff = new Date(Date.now() - DELIVERY_EVENT_LOOKUP_DAYS * DAY_MS).getTime();
    const now = new Date().toISOString();

    // Store pickups, digital items etc. have no shipping address — nothing to track.
    const orders = (await fetchOrdersSince(storeUrl, accessToken, since)).filter((o) => o.shipping_address);

    // Every existing row for these orders, keyed by shipment_key …
    const existing = new Map<string, any>();
    const orderIds = orders.map((o) => o.id);
    for (let i = 0; i < orderIds.length; i += CHUNK) {
        const { data, error } = await supabaseAdmin
            .from('order_shipments')
            .select('*')
            .in('shopify_order_id', orderIds.slice(i, i + CHUNK));
        if (error) throw new Error(`Failed to load shipments: ${error.message}`);
        (data || []).forEach((row) => existing.set(row.shipment_key, row));
    }

    // … plus imported / manual rows not yet linked to Shopify, by order name.
    const adoptable = new Map<string, any[]>();
    const orderNames = orders.map((o) => o.name);
    for (const column of ['order_name', 'shipment_ref']) {
        for (let i = 0; i < orderNames.length; i += CHUNK) {
            const { data, error } = await supabaseAdmin
                .from('order_shipments')
                .select('*')
                .is('shopify_order_id', null)
                .in(column, orderNames.slice(i, i + CHUNK));
            if (error) throw new Error(`Failed to load imported shipments: ${error.message}`);
            for (const row of data || []) {
                const list = adoptable.get(row[column]) || [];
                if (!list.some((r) => r.id === row.id)) list.push(row);
                adoptable.set(row[column], list);
            }
        }
    }

    const adopted = new Set<string>();
    // Claim an imported row for this order, preferring one whose ref matches.
    const adopt = (order: any, shipmentRef: string) => {
        const candidates = (adoptable.get(order.name) || []).filter((r) => !adopted.has(r.id));
        const row = candidates.find((r) => r.shipment_ref === shipmentRef) || candidates[0];
        if (!row) return null;
        adopted.add(row.id);
        return { ...row, source: 'SHOPIFY', shopify_order_id: order.id };
    };

    const rows: any[] = [];
    let created = 0;
    let updated = 0;
    let cancelled = 0;

    for (const order of orders) {
        const base = orderFields(order);
        const pendingKey = `${order.id}:pending`;

        if (order.cancelled_at) {
            for (const row of existing.values()) {
                if (row.shopify_order_id === order.id && row.status !== 'CANCELLED' && row.status !== 'DELIVERED') {
                    rows.push({ ...row, status: 'CANCELLED', last_synced_at: now });
                    cancelled++;
                }
            }
            continue;
        }

        const fulfillments = (order.fulfillments || []).filter((f) => f.status !== 'cancelled');
        const cancelledFulfillments = (order.fulfillments || []).filter((f) => f.status === 'cancelled');

        for (const f of cancelledFulfillments) {
            const row = existing.get(`${order.id}:${f.id}`);
            if (row && row.status !== 'CANCELLED' && row.status !== 'DELIVERED') {
                rows.push({ ...row, status: 'CANCELLED', last_synced_at: now });
                cancelled++;
            }
        }

        if (fulfillments.length === 0) {
            const row = existing.get(pendingKey) || adopt(order, order.name);
            const incoming = { ...base, shipment_ref: order.name };
            if (row) updated++;
            else created++;
            rows.push(merge({ ...(row || newRow(pendingKey, order, now)), shipment_key: pendingKey }, incoming, now));
            continue;
        }

        let placeholder = existing.get(pendingKey) || null;

        for (const f of fulfillments) {
            const key = `${order.id}:${f.id}`;
            const shipmentRef = `${order.name}-F${fulfillmentNumber(f, order.fulfillments)}`;
            const status = mapShipmentStatus(f.shipment_status);

            // Promote the placeholder (or an imported row) so notes and
            // notified flags carry over.
            let row = existing.get(key);
            if (!row && placeholder) {
                row = placeholder;
                placeholder = null;
            }
            if (!row) row = adopt(order, shipmentRef);

            let deliveredDate = null;
            if (status === 'DELIVERED' && !row?.delivered_date) {
                deliveredDate = new Date(order.created_at).getTime() >= eventCutoff
                    ? await fetchDeliveredDate(storeUrl, accessToken, order.id, f)
                    : istDate(f.updated_at);
            }

            const incoming = {
                ...base,
                shipment_ref: shipmentRef,
                shopify_fulfillment_id: f.id,
                courier: f.tracking_company || null,
                awb_number: f.tracking_number || (f.tracking_numbers || [])[0] || null,
                tracking_url: f.tracking_url || (f.tracking_urls || [])[0] || null,
                courier_status: f.shipment_status || null,
                status,
                pickup_date: istDate(f.created_at),
                delivered_date: deliveredDate,
            };

            if (row) updated++;
            else created++;
            rows.push(merge({ ...(row || newRow(key, order, now)), shipment_key: key }, incoming, now));
        }
    }

    for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabaseAdmin
            .from('order_shipments')
            .upsert(rows.slice(i, i + CHUNK), { onConflict: 'id' });
        if (error) throw new Error(`Failed to save shipments: ${error.message}`);
    }

    console.log(`Shipment sync: ${orders.length} orders, ${created} created, ${updated} updated, ${cancelled} cancelled`);
    return { success: true, ordersScanned: orders.length, created, updated, cancelled, syncedAt: now };
}
