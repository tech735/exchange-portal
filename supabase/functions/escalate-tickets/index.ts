// @ts-nocheck
// Runs hourly (see migration add_ticket_escalation_cron.sql) and performs the
// 3 time-based checks in the SLA workflow. Each check is guarded by its own
// "already sent" timestamp column so a ticket gets exactly one notification
// per milestone, no matter how many times this function runs.
//
//  2 days after created_at   -> Warehouse + Tech, if stage hasn't progressed
//                               past RETURN_PENDING (no meaningful progress).
//                               This is a WARNING, not a breach.
//  5 days after return_booked_at -> Warehouse, if QC decision or the
//                               replacement exchange booking is still missing.
//                               This IS a breach (sla_breached = true).
//  7 days after return_booked_at -> Tech, if the ticket isn't fully closed out
//                               (invoiced, refund settled if applicable, and
//                               CLOSED). This IS a breach (sla_breached = true).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { listTable, sendResendEmail, wrapEmail } from '../_shared/email.ts';

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

function parseList(value: string | undefined): string[] {
  return (value ?? '').split(',').map((email) => email.trim()).filter(Boolean);
}

function ageDaysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
    const techEmails = parseList(Deno.env.get('ADMIN_NOTIFICATION_EMAIL'));
    const warehouseEmails = parseList(Deno.env.get('WAREHOUSE_NOTIFICATION_EMAILS'));

    if (!supabaseUrl || !serviceKey || !resendApiKey || !fromEmail || (techEmails.length === 0 && warehouseEmails.length === 0)) {
      console.error('escalate-tickets: missing required secret(s)');
      return new Response(JSON.stringify({ error: 'Escalation service not configured' }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const now = new Date();
    const results = { twoDayWarning: 0, warehouseBreach: 0, techBreach: 0 };

    // --- 2-day: no meaningful progress warning (Warehouse + Tech) ---
    const twoDayCutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stalled, error: stalledError } = await supabase
      .from('tickets')
      .select('id, order_id, customer_name, customer_phone, stage, created_at')
      .is('sla_2day_warning_sent_at', null)
      .lt('created_at', twoDayCutoff)
      .in('stage', ['LODGED', 'RETURN_PENDING']);
    if (stalledError) throw stalledError;

    if (stalled && stalled.length > 0) {
      const ids = stalled.map((t) => t.id);
      const { error: markError } = await supabase
        .from('tickets')
        .update({ sla_2day_warning_sent_at: now.toISOString() })
        .in('id', ids);
      if (markError) throw markError;

      const rows = stalled.map((t) => [
        String(t.id).slice(0, 8),
        STAGE_LABELS[t.stage] ?? t.stage,
        `${ageDaysSince(t.created_at)}d`,
        `${t.customer_name} (${t.customer_phone})`,
        String(t.order_id),
      ]);
      await sendResendEmail({
        apiKey: resendApiKey,
        from: fromEmail,
        to: Array.from(new Set([...warehouseEmails, ...techEmails])),
        subject: `${stalled.length} ticket(s) approaching SLA — no progress after 2 days`,
        html: wrapEmail(
          'SLA warning — 2 days, no progress',
          `${stalled.length} ticket(s) still stuck at Lodged/Return Pending`,
          `<p style="margin:0 0 16px;color:#334155;font-size:14px;">These tickets were created more than 2 days ago and haven't progressed past Return Pending. Please verify pickup/logistics and warehouse intake.</p>${listTable(['Ticket', 'Stage', 'Age', 'Customer', 'Order ID'], rows)}`
        ),
      });
      results.twoDayWarning = stalled.length;
    }

    // --- 5-day: Warehouse breach (QC / replacement prep incomplete) ---
    const fiveDayCutoff = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data: warehouseOverdue, error: warehouseError } = await supabase
      .from('tickets')
      .select('id, order_id, customer_name, customer_phone, stage, return_booked_at, qc_decision, exchange_booked_at')
      .is('sla_warehouse_breach_sent_at', null)
      .not('return_booked_at', 'is', null)
      .lt('return_booked_at', fiveDayCutoff)
      .or('qc_decision.is.null,exchange_booked_at.is.null');
    if (warehouseError) throw warehouseError;

    if (warehouseOverdue && warehouseOverdue.length > 0) {
      const ids = warehouseOverdue.map((t) => t.id);
      const { error: markError } = await supabase
        .from('tickets')
        .update({ sla_warehouse_breach_sent_at: now.toISOString(), sla_breached: true, sla_breached_at: now.toISOString() })
        .in('id', ids);
      if (markError) throw markError;

      const rows = warehouseOverdue.map((t) => [
        String(t.id).slice(0, 8),
        STAGE_LABELS[t.stage] ?? t.stage,
        `${ageDaysSince(t.return_booked_at)}d since return booked`,
        t.qc_decision ? 'QC done' : 'QC missing',
        t.exchange_booked_at ? 'Exchange booked' : 'Exchange not booked',
        `${t.customer_name} (${t.customer_phone})`,
      ]);
      await sendResendEmail({
        apiKey: resendApiKey,
        from: fromEmail,
        to: warehouseEmails.length ? warehouseEmails : techEmails,
        subject: `${warehouseOverdue.length} ticket(s) — Warehouse SLA breach (5 days)`,
        html: wrapEmail(
          'Warehouse SLA breach',
          `${warehouseOverdue.length} ticket(s) incomplete 5 days after return booked`,
          `<p style="margin:0 0 16px;color:#334155;font-size:14px;">QC and/or replacement booking is still incomplete more than 5 days after the return was booked.</p>${listTable(['Ticket', 'Stage', 'Age', 'QC', 'Replacement', 'Customer'], rows)}`
        ),
      });
      results.warehouseBreach = warehouseOverdue.length;
    }

    // --- 7-day: Tech breach (invoicing / refund / closure incomplete) ---
    const sevenDayCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: techOverdue, error: techError } = await supabase
      .from('tickets')
      .select('id, order_id, customer_name, customer_phone, stage, return_booked_at, closed_at, invoicing_done_at, refund_status, refund_sent_at')
      .is('sla_tech_breach_sent_at', null)
      .not('return_booked_at', 'is', null)
      .lt('return_booked_at', sevenDayCutoff)
      .or('stage.neq.CLOSED,closed_at.is.null,invoicing_done_at.is.null,and(refund_status.neq.NONE,refund_sent_at.is.null)');
    if (techError) throw techError;

    if (techOverdue && techOverdue.length > 0) {
      const ids = techOverdue.map((t) => t.id);
      const { error: markError } = await supabase
        .from('tickets')
        .update({ sla_tech_breach_sent_at: now.toISOString(), sla_breached: true, sla_breached_at: now.toISOString() })
        .in('id', ids);
      if (markError) throw markError;

      const rows = techOverdue.map((t) => [
        String(t.id).slice(0, 8),
        STAGE_LABELS[t.stage] ?? t.stage,
        `${ageDaysSince(t.return_booked_at)}d since return booked`,
        t.invoicing_done_at ? 'Invoiced' : 'Not invoiced',
        t.refund_status !== 'NONE' && !t.refund_sent_at ? 'Refund pending' : 'Refund ok/n-a',
        t.closed_at ? 'Closed' : 'Not closed',
      ]);
      await sendResendEmail({
        apiKey: resendApiKey,
        from: fromEmail,
        to: techEmails.length ? techEmails : warehouseEmails,
        subject: `${techOverdue.length} ticket(s) — Tech SLA breach (7 days)`,
        html: wrapEmail(
          'Tech SLA breach',
          `${techOverdue.length} ticket(s) not fully closed out 7 days after return booked`,
          `<p style="margin:0 0 16px;color:#334155;font-size:14px;">Invoicing, refund settlement, or ticket closure is still incomplete more than 7 days after the return was booked.</p>${listTable(['Ticket', 'Stage', 'Age', 'Invoicing', 'Refund', 'Closed'], rows)}`
        ),
      });
      results.techBreach = techOverdue.length;
    }

    return new Response(JSON.stringify(results), { status: 200 });
  } catch (err) {
    console.error('escalate-tickets: unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
