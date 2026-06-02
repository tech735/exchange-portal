// @ts-nocheck
// Aggregates ticket KPI stats server-side and caches the result in Redis.
// Multiple simultaneous users share a single cached result, so the DB is hit
// at most once per TTL interval regardless of how many clients are connected.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as redis from '../_shared/redis.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_KEY = 'ticket_stats:v1';
const CACHE_TTL = 60; // seconds

export interface TicketStats {
  totalOpen: number;
  pendingWarehouse: number;
  pendingInvoicing: number;
  slaBreached: number;
  completedThisWeek: number;
  denied: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Check Redis cache first — avoids a DB round-trip for all but the first request per minute
  const cached = await redis.get<TicketStats>(CACHE_KEY);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      status: 200,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Service credentials not configured' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Select only the 4 columns needed for aggregation — avoids fetching large JSONB fields
  const { data, error } = await supabase
    .from('tickets')
    .select('stage, status, sla_breached, created_at');

  if (error) {
    console.error('ticket-stats query error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const tickets = data as any[];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const stats: TicketStats = {
    totalOpen: tickets.filter(t => !['CLOSED', 'INVOICED'].includes(t.stage)).length,
    pendingWarehouse: tickets.filter(t => ['LODGED', 'WAREHOUSE_PENDING'].includes(t.stage)).length,
    pendingInvoicing: tickets.filter(t => ['EXCHANGE_COMPLETED', 'INVOICING_PENDING'].includes(t.stage)).length,
    slaBreached: tickets.filter(t => t.sla_breached).length,
    completedThisWeek: tickets.filter(t => t.status === 'COMPLETED' && new Date(t.created_at) >= weekAgo).length,
    denied: tickets.filter(t => t.status === 'DENIED').length,
  };

  // Cache for CACHE_TTL seconds — fire and forget, don't block the response
  redis.set(CACHE_KEY, stats, CACHE_TTL).catch(err => console.warn('Redis set failed:', err));

  return new Response(JSON.stringify(stats), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    status: 200,
  });
});
