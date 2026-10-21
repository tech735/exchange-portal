// @ts-nocheck
// Sends a milestone notification email as a ticket moves through the exchange
// state machine. Called by a Postgres trigger (see migration
// add_ticket_notification_trigger.sql) via pg_net — the trigger itself
// already filters out non-stage field edits, so this function receives only
// INSERT and stage-change UPDATE events. It talks to the DB directly and has
// no CORS surface to expose.
//
// Recipient routing follows the SLA workflow's responsible teams:
//   - Ticket lodged (INSERT)         -> Logistics + Warehouse
//   - Stage -> EXCHANGE_BOOKED       -> Warehouse + Tech (with full details)
//   - Any other stage change         -> the general team list (visibility only)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { keyValueTable, paragraph, sendResendEmail, wrapEmail } from '../_shared/email.ts';
import { requireCaller } from '../_shared/auth.ts';

interface TicketChangePayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

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

function stageLabel(stage: unknown): string {
  return STAGE_LABELS[String(stage)] ?? String(stage ?? 'n/a');
}

function formatItems(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return 'none';
  return items
    .map((item) => `${item?.product_name ?? 'item'} (${item?.size ?? '-'}) x${item?.qty ?? 1}`)
    .join(', ');
}

function ticketRefOf(record: Record<string, unknown>): string {
  return String(record['id'] ?? 'unknown').slice(0, 8);
}

function parseList(value: string | undefined): string[] {
  return (value ?? '').split(',').map((email) => email.trim()).filter(Boolean);
}

type Recipients = { logistics: string[]; warehouse: string[]; tech: string[]; team: string[] };

function describeChange(payload: TicketChangePayload, recipients: Recipients): { subject: string; heading: string; subheading: string; bodyHtml: string; to: string[] } {
  const record = payload.record ?? {};
  const old = payload.old_record ?? {};
  const ticketRef = ticketRefOf(record);

  if (payload.type === 'INSERT') {
    return {
      subject: `New ticket lodged — ${ticketRef}`,
      heading: 'New ticket lodged',
      subheading: '',
      bodyHtml:
        paragraph('Dear Team,') +
        paragraph('A new exchange ticket has been lodged. Please book the pickup for this return. Details below:') +
        keyValueTable([
          ['Ticket', ticketRef],
          ['Order ID', String(record['order_id'] ?? 'n/a')],
          ['Customer', `${record['customer_name'] ?? 'n/a'} (${record['customer_phone'] ?? 'no phone'})`],
          ['Email', String(record['customer_email'] ?? 'n/a')],
          ['Student', `${record['student_name'] ?? 'n/a'} — ${record['school_name'] ?? 'n/a'}`],
          ['Reason', `${record['reason_code'] ?? 'n/a'}${record['reason_notes'] ? ` — ${record['reason_notes']}` : ''}`],
          ['Return items', formatItems(record['return_items'])],
          ['Exchange items', formatItems(record['exchange_items'])],
        ]),
      to: withFallback(dedupe([...recipients.logistics, ...recipients.warehouse]), recipients.team),
    };
  }

  const fromStage = stageLabel(old['stage']);
  const toStage = stageLabel(record['stage']);

  if (String(record['stage']) === 'EXCHANGE_BOOKED') {
    return {
      subject: `Exchange booked — ticket ${ticketRef}`,
      heading: 'Exchange booked',
      subheading: '',
      bodyHtml:
        paragraph('The exchange for this ticket has been booked. Warehouse: please prepare for QC and replacement dispatch. Tech: please confirm the ticket workflow is in sync. Details below:') +
        keyValueTable([
        ['Ticket', ticketRef],
        ['Order ID', String(record['order_id'] ?? 'n/a')],
        ['Customer', `${record['customer_name'] ?? 'n/a'} (${record['customer_phone'] ?? 'no phone'})`],
        ['Email', String(record['customer_email'] ?? 'n/a')],
        ['Student', `${record['student_name'] ?? 'n/a'} — ${record['school_name'] ?? 'n/a'}`],
        ['Return items', formatItems(record['return_items'])],
        ['Exchange items', formatItems(record['exchange_items'])],
        ['Return AWB', `${record['return_awb'] ?? 'n/a'} (${record['return_aggregator'] ?? 'n/a'})`],
        ['Exchange AWB', `${record['exchange_awb'] ?? 'n/a'} (${record['exchange_aggregator'] ?? 'n/a'})`],
        ['Booked at', String(record['exchange_booked_at'] ?? 'n/a')],
      ]),
      to: withFallback(dedupe([...recipients.warehouse, ...recipients.tech]), recipients.team),
    };
  }

  return {
    subject: `Ticket ${ticketRef} moved to ${toStage}`,
    heading: 'Ticket stage changed',
    subheading: `Ticket ${ticketRef}`,
    bodyHtml: keyValueTable([
      ['Ticket', ticketRef],
      ['Stage change', `${fromStage} → ${toStage}`],
      ['Customer', `${record['customer_name'] ?? 'n/a'} (${record['customer_email'] ?? 'no email'})`],
    ]),
    to: recipients.team,
  };
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}

function withFallback(list: string[], fallback: string[]): string[] {
  return list.length ? list : fallback;
}

serve(async (req: Request) => {
  // Only pg_cron / DB triggers call this; they send the service role key.
  const denied = await requireCaller(req, 'service');
  if (denied) return denied;

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
    const teamEmails = parseList(Deno.env.get('TEAM_NOTIFICATION_EMAILS'));
    const logisticsEmails = parseList(Deno.env.get('LOGISTICS_NOTIFICATION_EMAILS'));
    const warehouseEmails = parseList(Deno.env.get('WAREHOUSE_NOTIFICATION_EMAILS'));
    const techEmails = parseList(Deno.env.get('ADMIN_NOTIFICATION_EMAIL'));

    if (!resendApiKey || !fromEmail || teamEmails.length === 0) {
      console.error('notify-team: missing RESEND_API_KEY, RESEND_FROM_EMAIL, or TEAM_NOTIFICATION_EMAILS secret');
      return new Response(JSON.stringify({ error: 'Notification service not configured' }), { status: 500 });
    }

    const payload: TicketChangePayload = await req.json();
    if (payload.type === 'DELETE') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const recipients: Recipients = {
      logistics: logisticsEmails.length ? logisticsEmails : teamEmails,
      warehouse: warehouseEmails.length ? warehouseEmails : teamEmails,
      tech: techEmails,
      team: teamEmails,
    };

    const { subject, heading, subheading, bodyHtml, to } = describeChange(payload, recipients);
    const finalRecipients = to.length ? to : teamEmails;

    const res = await sendResendEmail({
      apiKey: resendApiKey,
      from: fromEmail,
      to: finalRecipients,
      subject,
      html: wrapEmail(heading, subheading, bodyHtml),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error('notify-team: Resend API error', res.status, errorBody);
      return new Response(JSON.stringify({ error: 'Failed to send notification' }), { status: 502 });
    }

    return new Response(JSON.stringify({ sent: true }), { status: 200 });
  } catch (err) {
    console.error('notify-team: unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
