/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// @ts-nocheck
// Shopify returns → public.order_shipments (run by action: syncShipments,
// after the fulfillment sync in shipments.ts).
//
// Returns are booked on the aggregators but recorded on Shopify for the
// inventory sync, so Shopify is the list of returns: one row per return,
// named the way Shopify names them (<order>-R1, -R2 …), with the return AWB
// from its reverse delivery once one is added there (or typed into the
// tracker). track-shipments then follows the AWB like any other shipment.
//
// Shopify return → tracker status: requested / open → Awaiting Pickup,
// closed (processed) → Delivered, cancelled / declined → Cancelled; status
// only moves forward, as in shipments.ts.
//
// Returns only exist in the GraphQL Admin API, so the app's token needs the
// read_returns scope (and read_orders). Two steps keep each query cheap:
// list orders updated in the window with their return status, then load the
// returns of just the orders that have one.

import { CHUNK, DEFAULT_LOOKBACK_DAYS, istDate, merge, newRow } from './shipments.ts';

const GRAPHQL_API_VERSION = '2026-04';
const RETURN_ORDER_BATCH = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const ORDERS_QUERY = `
  query OrdersWithReturns($query: String!, $after: String) {
    orders(first: 100, after: $after, query: $query) {
      nodes { id returnStatus }
      pageInfo { hasNextPage endCursor }
    }
  }`;

const RETURNS_QUERY = `
  query OrderReturns($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        legacyResourceId
        name
        createdAt
        cancelledAt
        email
        phone
        shippingAddress { name firstName lastName phone city province zip }
        customer { firstName lastName }
        returns(first: 5) {
          nodes {
            id
            name
            status
            createdAt
            closedAt
            reverseFulfillmentOrders(first: 2) {
              nodes {
                reverseDeliveries(first: 2) {
                  nodes {
                    deliverable {
                      ... on ReverseDeliveryShippingDeliverable {
                        tracking { number url carrierName }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;

const RETURN_STATUS: Record<string, string> = {
  CANCELED: 'CANCELLED',
  DECLINED: 'CANCELLED',
  CLOSED: 'DELIVERED',
};

async function graphql(storeUrl: string, accessToken: string, query: string, variables: Record<string, unknown>) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`https://${storeUrl}/admin/api/${GRAPHQL_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({ query, variables }),
    });
    const body = await response.json().catch(() => null);
    const errors = Array.isArray(body?.errors) ? body.errors : body?.errors ? [{ message: String(body.errors) }] : [];
    const throttled = errors.some((e: any) => e.extensions?.code === 'THROTTLED');
    if (throttled && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      continue;
    }
    if (!response.ok || errors.length) {
      const detail = errors.map((e: any) => e.message).join('; ') || `HTTP ${response.status}`;
      throw new Error(`Shopify returns query failed: ${detail}`);
    }
    return body.data;
  }
}

const gidNumber = (gid: string) => Number(String(gid).split('/').pop());

// Shopify's own return name when it has the -R<n> form, else numbered by
// creation order.
function returnRef(orderName: string, ret: any, index: number) {
  const name = String(ret.name ?? '').replace(/^#/, '').trim();
  return /-R\d+$/i.test(name) ? name : `${orderName}-R${index + 1}`;
}

function orderFields(order: any) {
  const address = order.shippingAddress || {};
  const customer = order.customer || {};
  return {
    order_name: order.name,
    order_date: istDate(order.createdAt),
    customer_name:
      address.name ||
      [address.firstName, address.lastName].filter(Boolean).join(' ') ||
      [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
      null,
    customer_phone: address.phone || order.phone || null,
    customer_email: order.email || null,
    city: address.city || null,
    state: address.province || null,
    pincode: address.zip || null,
  };
}

export async function syncReturns({ supabaseAdmin, storeUrl, accessToken, lookbackDays }) {
  const days = Number(lookbackDays) > 0 ? Number(lookbackDays) : DEFAULT_LOOKBACK_DAYS;
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const now = new Date().toISOString();

  // 1. Orders updated in the window that have a return.
  const orderIds: string[] = [];
  let after: string | null = null;
  do {
    const data = await graphql(storeUrl, accessToken, ORDERS_QUERY, { query: `updated_at:>='${since}'`, after });
    for (const order of data.orders.nodes) {
      if (order.returnStatus && order.returnStatus !== 'NO_RETURN') orderIds.push(order.id);
    }
    after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
  } while (after);

  // 2. Their returns.
  const orders: any[] = [];
  for (let i = 0; i < orderIds.length; i += RETURN_ORDER_BATCH) {
    const data = await graphql(storeUrl, accessToken, RETURNS_QUERY, { ids: orderIds.slice(i, i + RETURN_ORDER_BATCH) });
    orders.push(...(data.nodes || []).filter((o: any) => o && !o.cancelledAt));
  }

  // 3. One row per return.
  const incoming = new Map<string, { order: any; fields: Record<string, any> }>();
  for (const order of orders) {
    const base = orderFields(order);
    const returns = [...(order.returns?.nodes || [])].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    returns.forEach((ret, index) => {
      const tracking = (ret.reverseFulfillmentOrders?.nodes || [])
        .flatMap((rfo: any) => rfo.reverseDeliveries?.nodes || [])
        .map((delivery: any) => delivery.deliverable?.tracking)
        .find((t: any) => t?.number);
      const status = RETURN_STATUS[ret.status] ?? 'AWAITING_PICKUP';

      incoming.set(`${order.legacyResourceId}:return:${gidNumber(ret.id)}`, {
        order,
        fields: {
          ...base,
          shipment_ref: returnRef(order.name, ret, index),
          raised_date: istDate(ret.createdAt),
          courier: tracking?.carrierName || null,
          awb_number: tracking?.number || null,
          tracking_url: tracking?.url || null,
          status,
          delivered_date: status === 'DELIVERED' ? istDate(ret.closedAt || now) : null,
        },
      });
    });
  }

  const keys = [...incoming.keys()];
  const existing = new Map<string, any>();
  for (let i = 0; i < keys.length; i += CHUNK) {
    const { data, error } = await supabaseAdmin.from('order_shipments').select('*').in('shipment_key', keys.slice(i, i + CHUNK));
    if (error) throw new Error(`Failed to load return shipments: ${error.message}`);
    (data || []).forEach((row) => existing.set(row.shipment_key, row));
  }

  let created = 0;
  const rows = keys.map((key) => {
    const { order, fields } = incoming.get(key);
    let row = existing.get(key);
    if (!row) {
      created++;
      row = newRow(key, { id: Number(order.legacyResourceId), name: order.name, created_at: order.createdAt }, now);
    }
    return merge(row, fields, now);
  });

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabaseAdmin.from('order_shipments').upsert(rows.slice(i, i + CHUNK), { onConflict: 'id' });
    if (error) throw new Error(`Failed to save return shipments: ${error.message}`);
  }

  console.log(`Return sync: ${orders.length} orders with returns, ${rows.length} returns, ${created} new`);
  return { ordersWithReturns: orders.length, returns: rows.length, created, updated: rows.length - created };
}
