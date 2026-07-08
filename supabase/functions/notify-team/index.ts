// @ts-nocheck
// Sends a team notification email when a ticket is lodged, or when its stage
// changes (LODGED -> RETURN_PENDING -> ... -> CLOSED). Called by a Postgres
// trigger (see migration add_ticket_notification_trigger.sql) via pg_net —
// the trigger itself already filters out non-stage field edits, so this
// function receives only INSERT and stage-change UPDATE events. It talks to
// the DB directly and has no CORS surface to expose.
//
// When a ticket moves into EXCHANGE_BOOKED, the admin also gets a detailed
// summary (order, customer, items, AWBs) rather than the terse one-liner
// used for other stage transitions.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

function keyDetailsLines(record: Record<string, unknown>): string[] {
  return [
    `Ticket: ${String(record['id'] ?? 'unknown').slice(0, 8)}`,
    `Order ID: ${record['order_id'] ?? 'n/a'}`,
    `Customer: ${record['customer_name'] ?? 'n/a'} (${record['customer_phone'] ?? 'no phone'}, ${record['customer_email'] ?? 'no email'})`,
    `Student: ${record['student_name'] ?? 'n/a'} — ${record['school_name'] ?? 'n/a'}`,
    `Return items: ${formatItems(record['return_items'])}`,
    `Exchange items: ${formatItems(record['exchange_items'])}`,
    `Return AWB: ${record['return_awb'] ?? 'n/a'} (${record['return_aggregator'] ?? 'n/a'})`,
    `Exchange AWB: ${record['exchange_awb'] ?? 'n/a'} (${record['exchange_aggregator'] ?? 'n/a'})`,
    `Exchange booked at: ${record['exchange_booked_at'] ?? 'n/a'}`,
  ];
}

function describeChange(payload: TicketChangePayload): { subject: string; lines: string[]; toAdmin: boolean } {
  const record = payload.record ?? {};
  const old = payload.old_record ?? {};
  const ticketRef = String(record['id'] ?? 'unknown').slice(0, 8);

  if (payload.type === 'INSERT') {
    return {
      subject: `New ticket lodged — ${ticketRef}`,
      lines: [
        `A new exchange/return ticket was lodged.`,
        `Ticket: ${ticketRef}`,
        `Stage: ${stageLabel(record['stage'])}`,
        `Customer: ${record['customer_name'] ?? 'n/a'} (${record['customer_email'] ?? 'no email'})`,
      ],
      toAdmin: false,
    };
  }

  const fromStage = stageLabel(old['stage']);
  const toStage = stageLabel(record['stage']);

  if (String(record['stage']) === 'EXCHANGE_BOOKED') {
    return {
      subject: `Exchange booked — ticket ${ticketRef}`,
      lines: [`Ticket ${ticketRef} exchange has been booked. Key details:`, '', ...keyDetailsLines(record)],
      toAdmin: true,
    };
  }

  return {
    subject: `Ticket ${ticketRef} moved to ${toStage}`,
    lines: [
      `Ticket ${ticketRef} changed stage.`,
      `${fromStage} → ${toStage}`,
      `Customer: ${record['customer_name'] ?? 'n/a'} (${record['customer_email'] ?? 'no email'})`,
    ],
    toAdmin: false,
  };
}

serve(async (req: Request) => {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
    const teamEmails = Deno.env.get('TEAM_NOTIFICATION_EMAILS');
    const adminEmail = Deno.env.get('ADMIN_NOTIFICATION_EMAIL');

    if (!resendApiKey || !fromEmail || !teamEmails) {
      console.error('notify-team: missing RESEND_API_KEY, RESEND_FROM_EMAIL, or TEAM_NOTIFICATION_EMAILS secret');
      return new Response(JSON.stringify({ error: 'Notification service not configured' }), { status: 500 });
    }

    const payload: TicketChangePayload = await req.json();
    if (payload.type === 'DELETE') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const { subject, lines, toAdmin } = describeChange(payload);
    const recipients = teamEmails.split(',').map((email) => email.trim()).filter(Boolean);
    if (toAdmin && adminEmail) {
      recipients.push(adminEmail);
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        subject,
        text: lines.join('\n'),
      }),
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
