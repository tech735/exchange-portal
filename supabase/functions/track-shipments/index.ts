/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// @ts-nocheck
// Runs every 10 minutes (see migration add_shipment_aggregator_tracking.sql).
// For every shipment with an AWB that isn't delivered, asks the aggregator it
// was booked through for the live courier status and sets the tracker status
// to match (Awaiting Pickup, Picked Up, In Transit, Out for Delivery,
// Delivered, RTO, Cancelled), filling the pickup and delivered dates from the
// courier's scans. The Shipments page listens for changes to order_shipments,
// so the dashboard updates as soon as this writes.
//
// The courier is the source of truth, even backwards: a parcel marked Picked
// Up that the courier still lists as pending pickup goes back to Awaiting
// Pickup and loses its pickup date. RTO and cancelled rows keep being checked
// (until resolved, for 60 days) since they can still change; see nextStatus.
// The courier's own wording is always saved in courier_status.
//
// The aggregator is remembered in order_shipments.aggregator once an AWB is
// found. Until then it is guessed from the tracking URL / courier name, and
// otherwise iThink is asked first, then ShipDelight. AWBs neither of them
// knows (e.g. booked directly with a courier) are retried at most hourly.
//
// Triggered by pg_cron with the service role key, like shipment-alerts.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  ITHINK_BATCH_SIZE,
  guessAggregator,
  isConfigured,
  trackIThink,
  trackShipDelight,
  type CourierTracking,
} from '../_shared/aggregatorTracking.ts';
import { istNow } from '../_shared/shipmentRules.ts';

const IN_FLIGHT = ['AWAITING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];
const CLOSED_CHECK_DAYS = 60;
const UNKNOWN_AWB_RETRY_MS = 60 * 60 * 1000;
const SHIPDELIGHT_CONCURRENCY = 5;

// RTO and Cancelled may have been set by the team or by Shopify, so the
// courier only moves them on with something more definite: an RTO parcel
// that is delivered or cancelled after all, and a cancelled one the courier
// picks up anyway.
function nextStatus(current: string, courier: string | null): string {
  if (!courier) return current;
  if (current === 'RTO') return courier === 'DELIVERED' || courier === 'CANCELLED' ? courier : current;
  if (current === 'CANCELLED') return courier === 'AWAITING_PICKUP' ? current : courier;
  return courier;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift() as T);
    })
  );
}

serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      console.error('track-shipments: missing Supabase service credentials');
      return json({ error: 'Not configured' }, 500);
    }
    const ithinkReady = isConfigured('ITHINK');
    const shipDelightReady = isConfigured('SHIPDELIGHT');
    if (!ithinkReady && !shipDelightReady) {
      console.error('track-shipments: no iThink or ShipDelight credentials set');
      return json({ error: 'No aggregator configured' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const closedSince = new Date(Date.now() - CLOSED_CHECK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('order_shipments')
      .select('id, status, awb_number, tracking_url, courier, aggregator, courier_status, pickup_date, delivered_date, tracking_error, tracking_error_at')
      .not('awb_number', 'is', null)
      .neq('status', 'DELIVERED')
      .or(`status.in.(${IN_FLIGHT.join(',')}),and(resolved_on.is.null,order_date.gte.${closedSince})`);
    if (error) throw error;

    const startedAt = Date.now();
    const shipments = (data || [])
      .map((s) => ({ ...s, awb_number: String(s.awb_number).trim() }))
      .filter((s) => s.awb_number)
      .filter(
        (s) => s.aggregator || !s.tracking_error_at || startedAt - Date.parse(s.tracking_error_at) > UNKNOWN_AWB_RETRY_MS
      );

    const found = new Map<string, CourierTracking>();
    const failures = new Map<string, string>();

    const askIThink = async (list: any[]) => {
      if (!ithinkReady) return;
      for (let i = 0; i < list.length; i += ITHINK_BATCH_SIZE) {
        const batch = list.slice(i, i + ITHINK_BATCH_SIZE);
        try {
          const result = await trackIThink(batch.map((s) => s.awb_number));
          batch.forEach((s) => result.has(s.awb_number) && found.set(s.id, result.get(s.awb_number)));
        } catch (err) {
          batch.forEach((s) => failures.set(s.id, err.message));
        }
      }
    };
    const askShipDelight = async (list: any[]) => {
      if (!shipDelightReady) return;
      await eachLimit(list, SHIPDELIGHT_CONCURRENCY, async (s) => {
        try {
          const result = await trackShipDelight(s.awb_number);
          if (result) found.set(s.id, result);
        } catch (err) {
          failures.set(s.id, err.message);
        }
      });
    };

    // Each shipment goes to its known / guessed aggregator first, and to the
    // other one if that one doesn't know the AWB.
    const shipDelightFirst = shipments.filter((s) => (s.aggregator ?? guessAggregator(s)) === 'SHIPDELIGHT');
    const iThinkFirst = shipments.filter((s) => !shipDelightFirst.includes(s));
    const notFound = (list: any[]) => list.filter((s) => !found.has(s.id));

    await Promise.all([askIThink(iThinkFirst), askShipDelight(shipDelightFirst)]);
    await Promise.all([askShipDelight(notFound(iThinkFirst)), askIThink(notFound(shipDelightFirst))]);

    const { date: today } = istNow();
    const nowIso = new Date().toISOString();
    const results = { checked: shipments.length, updated: 0, statusChanged: 0, notFound: 0, failed: 0 };

    await eachLimit(shipments, 10, async (s) => {
      const tracking = found.get(s.id);
      let patch: Record<string, unknown>;

      if (!tracking) {
        const message = failures.get(s.id);
        if (message) results.failed++;
        else results.notFound++;
        patch = {
          tracking_error: message ?? 'AWB not found at iThink or ShipDelight',
          tracking_error_at: nowIso,
          // A clean miss everywhere means the AWB changed or was never booked
          // through an aggregator; look it up from scratch next time.
          ...(message ? {} : { aggregator: null }),
        };
      } else {
        const status = nextStatus(s.status, tracking.status);
        const next = {
          aggregator: tracking.aggregator,
          courier_status: tracking.courierStatus,
          status,
          pickup_date:
            status === 'AWAITING_PICKUP'
              ? null
              : status === 'CANCELLED'
                ? tracking.pickupDate ?? s.pickup_date
                : tracking.pickupDate ?? s.pickup_date ?? today,
          delivered_date: status === 'DELIVERED' ? tracking.deliveredDate ?? s.delivered_date ?? today : null,
          tracking_error: null,
          tracking_error_at: null,
        };
        patch = Object.fromEntries(Object.entries(next).filter(([key, value]) => s[key] !== value));
        if (patch.status) results.statusChanged++;
      }

      if (Object.keys(patch).length === 0) return;
      const { error: updateError } = await supabase.from('order_shipments').update(patch).eq('id', s.id);
      if (updateError) console.error(`track-shipments: could not update ${s.id}:`, updateError.message);
      else results.updated++;
    });

    if (results.failed) {
      const sample = [...new Set(failures.values())].slice(0, 5);
      console.warn('track-shipments: aggregator errors', JSON.stringify(sample));
    }
    console.log('track-shipments:', JSON.stringify(results));
    return json({ success: true, ...results });
  } catch (err) {
    console.error('track-shipments: unexpected error', err);
    return json({ error: err.message ?? 'Internal error' }, 500);
  }
});
