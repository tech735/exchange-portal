// @ts-nocheck
// Runs on a schedule (see migration add_ticket_escalation_cron.sql, every
// hour via pg_cron). Finds tickets open more than 2 days that haven't been
// closed and haven't already been flagged, marks them sla_breached (reusing
// the existing column the UI already renders a badge for), and emails the
// admin a summary so nothing sits untouched past SLA.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SLA_HOURS = 48;

const STAGE_LABELS: Record<string, string> = {
  LODGED: 'Lodged',
  RETURN_PENDING: 'Return Pending',
  RETURN_RECEIVED: 'Return Received',
  WAREHOUSE_APPROVED: 'Warehouse Approved',
  WAREHOUSE_DENIED: 'Warehouse Denied',
  EXCHANGE_BOOKED: 'Exchange Booked',
  EXCHANGE_COMPLETED: 'Exchange Completed',
  INVOICING_PENDING: 'Invoicing Pending',
  INVOICED: 'Invoiced',
  TO_BE_REFUNDED: 'To Be Refunded',
  CLOSED: 'Closed',
  ESCALATED: 'Escalated',
};

serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
    const adminEmail = Deno.env.get('ADMIN_NOTIFICATION_EMAIL');

    if (!supabaseUrl || !serviceKey || !resendApiKey || !fromEmail || !adminEmail) {
      console.error('escalate-tickets: missing required secret(s)');
      return new Response(JSON.stringify({ error: 'Escalation service not configured' }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const cutoff = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000).toISOString();

    const { data: overdueTickets, error } = await supabase
      .from('tickets')
      .select('id, order_id, customer_name, customer_phone, customer_email, stage, created_at')
      .eq('sla_breached', false)
      .neq('stage', 'CLOSED')
      .lt('created_at', cutoff);

    if (error) throw error;

    if (!overdueTickets || overdueTickets.length === 0) {
      return new Response(JSON.stringify({ escalated: 0 }), { status: 200 });
    }

    const now = new Date().toISOString();
    const ids = overdueTickets.map((t) => t.id);
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ sla_breached: true, sla_breached_at: now })
      .in('id', ids);

    if (updateError) throw updateError;

    const lines = [
      `${overdueTickets.length} ticket(s) have been open more than ${SLA_HOURS / 24} days and were flagged as SLA breached:`,
      '',
      ...overdueTickets.map((t) => {
        const ref = String(t.id).slice(0, 8);
        const stage = STAGE_LABELS[t.stage] ?? t.stage;
        const ageDays = Math.floor((Date.now() - new Date(t.created_at).getTime()) / (24 * 60 * 60 * 1000));
        return `- Ticket ${ref} | ${stage} | ${ageDays}d old | ${t.customer_name} (${t.customer_phone}, ${t.customer_email ?? 'no email'}) | Order ${t.order_id}`;
      }),
    ];

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [adminEmail],
        subject: `${overdueTickets.length} ticket(s) escalated — SLA breach`,
        text: lines.join('\n'),
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error('escalate-tickets: Resend API error', res.status, errorBody);
      return new Response(JSON.stringify({ error: 'Failed to send escalation email' }), { status: 502 });
    }

    return new Response(JSON.stringify({ escalated: overdueTickets.length }), { status: 200 });
  } catch (err) {
    console.error('escalate-tickets: unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
