/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// @ts-nocheck
// Runs hourly (see migration create_order_shipments_table.sql), after the
// Shopify shipment sync, and applies the same deadline rules as the
// Shipments page:
//
//  Team digest  -> one email listing every shipment that newly missed its
//                  pickup deadline, its delivery deadline, or the RTO
//                  escalation limit. Each shipment is reported once per
//                  problem (pickup_alert_sent_at / delay_alert_sent_at /
//                  escalation_alert_sent_at).
//  Customer     -> when switched on in order_shipment_settings, an apology by
//                  email (Resend) and/or SMS (MSG91) to every customer whose
//                  order is past its delivery deadline and hasn't been
//                  informed yet; the shipment is then marked notified. Only
//                  sent between 9 AM and 9 PM IST, so a deadline that passes
//                  at midnight doesn't text anyone at 12:30 AM.
//
// Secrets: RESEND_API_KEY, RESEND_FROM_EMAIL, and for the team digest either
// team_alert_emails in order_shipment_settings or LOGISTICS_NOTIFICATION_EMAILS /
// ADMIN_NOTIFICATION_EMAIL. Optional: STORE_NAME (shown in customer messages).
// Customer emails are always sent from support@kotu.co.in (CUSTOMER_FROM_EMAIL);
// RESEND_FROM_EMAIL is only used for the team digest.
// SMS: MSG91_AUTH_KEY and MSG91_APOLOGY_TEMPLATE_ID — a DLT-approved MSG91
// template using the variables ##name## and ##order##.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { escapeHtml, listTable, paragraph, sendResendEmail, wrapEmail } from '../_shared/email.ts';
import { requireCaller } from '../_shared/auth.ts';
import {
  DEFAULT_SHIPMENT_SETTINGS,
  DELIVERY_CHECK_LABELS,
  SHIPMENT_KIND_LABELS,
  istNow,
  shipmentKind,
  trackShipment,
} from '../_shared/shipmentRules.ts';

const ZONE_LABELS = { DELHI_NCR: 'Delhi NCR', OUTSIDE_NCR: 'Outside NCR' };
const CUSTOMER_MESSAGE_HOURS = { from: 9, to: 21 }; // IST, [from, to)
const CUSTOMER_FROM_EMAIL = 'support@kotu.co.in';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function parseList(value: string | undefined): string[] {
  return (value ?? '').split(',').map((email) => email.trim()).filter(Boolean);
}

function displayDate(date: string | null): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

const firstName = (shipment: any) => shipment.customer_name?.trim().split(/\s+/)[0] || 'there';

// '98104 32269', '+91-98104-32269', '098104 32269' -> '919810432269'.
function indianMobile(phone: string | null): string | null {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return /^91[6-9]\d{9}$/.test(digits) ? digits : null;
}

function apologyEmail(shipment: any, storeName: string): string {
  const tracking = shipment.tracking_url
    ? `<p style="margin:0 0 12px;font-size:14px;">You can follow your parcel here: <a href="${escapeHtml(shipment.tracking_url)}">${escapeHtml(shipment.awb_number || 'track shipment')}</a></p>`
    : shipment.awb_number
      ? paragraph(`Courier: ${shipment.courier || '—'} · AWB ${shipment.awb_number}`)
      : '';

  return `
  <div style="font-family:Arial,sans-serif;padding:16px;color:#1f2937;">
    ${paragraph(`Hi ${firstName(shipment)},`)}
    ${paragraph(`We're sorry — your ${storeName} order ${shipment.order_name} is taking longer than expected to reach you. It is on its way with our courier partner and we are following up with them to get it delivered as soon as possible.`)}
    ${tracking}
    ${paragraph('If you have any questions, just reply to this email and our team will help.')}
    ${paragraph(`Thank you for your patience,`)}
    ${paragraph(`Team ${storeName}`)}
  </div>`;
}

// MSG91 Flow API. Returns null on success, otherwise the error message.
async function sendApologySms(authKey: string, templateId: string, mobile: string, shipment: any): Promise<string | null> {
  const response = await fetch('https://control.msg91.com/api/v5/flow', {
    method: 'POST',
    headers: { authkey: authKey, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      template_id: templateId,
      short_url: '0',
      // DLT variables are capped at 30 characters.
      recipients: [{ mobiles: mobile, name: firstName(shipment).slice(0, 30), order: String(shipment.order_name).slice(0, 30) }],
    }),
  });
  const body = await response.json().catch(() => null);
  return response.ok && body?.type === 'success' ? null : body?.message || `HTTP ${response.status}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Only pg_cron / DB triggers call this; they send the service role key.
  const denied = await requireCaller(req, 'service');
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
    const msg91AuthKey = Deno.env.get('MSG91_AUTH_KEY');
    const msg91TemplateId = Deno.env.get('MSG91_APOLOGY_TEMPLATE_ID');
    const storeName = Deno.env.get('STORE_NAME') || 'KOTU';
    const customerFrom = `${storeName} Support <${CUSTOMER_FROM_EMAIL}>`;

    if (!supabaseUrl || !serviceKey || !resendApiKey || !fromEmail) {
      console.error('shipment-alerts: missing required secret(s)');
      return json({ error: 'Shipment alerts not configured' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: settingsRow } = await supabase.from('order_shipment_settings').select('*').eq('id', 1).maybeSingle();
    const settings = { ...DEFAULT_SHIPMENT_SETTINGS, ...(settingsRow || {}) };
    const teamEmails = settings.team_alert_emails.length
      ? settings.team_alert_emails
      : [...parseList(Deno.env.get('LOGISTICS_NOTIFICATION_EMAILS')), ...parseList(Deno.env.get('ADMIN_NOTIFICATION_EMAIL'))];

    const { data: open, error } = await supabase
      .from('order_shipments')
      .select('*')
      .not('status', 'in', '(DELIVERED,CANCELLED,RTO)');
    if (error) throw error;

    const now = istNow();
    const tracked = (open || []).map((s) => ({ ...s, ...trackShipment(s, settings, now) }));
    const results = { latePickups: 0, delayed: 0, escalated: 0, customersNotified: 0, customersNotReached: 0 };

    // ── Team digest ─────────────────────────────
    const latePickups = tracked.filter((s) => s.check === 'PICKUP_DELAYED' && !s.pickup_alert_sent_at);
    const delayed = tracked.filter(
      (s) => (s.check === 'DELAYED_NOTIFY' || s.check === 'DELAYED_NOTIFIED') && !s.delay_alert_sent_at
    );
    const escalated = tracked.filter((s) => s.check === 'ESCALATED' && !s.escalation_alert_sent_at);

    const delayRows = (list: any[]) =>
      list.map((s) => [
        s.shipment_ref,
        SHIPMENT_KIND_LABELS[shipmentKind(s.shipment_ref)],
        ZONE_LABELS[s.delivery_zone],
        [s.courier, s.awb_number].filter(Boolean).join(' · ') || '—',
        displayDate(s.pickup_date),
        displayDate(s.expectedDelivery),
        String(s.daysDelayed ?? ''),
        `${s.customer_name || '—'} (${s.customer_notified ? 'notified' : 'not notified'})`,
      ]);
    const delayHeaders = ['Order', 'Type', 'Zone', 'Courier · AWB', 'Picked up', 'Due', 'Days late', 'Customer'];

    if ((latePickups.length || delayed.length || escalated.length) && teamEmails.length) {
      const sections: string[] = [];
      if (escalated.length) {
        sections.push(
          paragraph(`Escalated — ${settings.rto_escalation_days}+ days past the delivery deadline. Decide on RTO in the tracker:`),
          listTable(delayHeaders, delayRows(escalated))
        );
      }
      if (latePickups.length) {
        sections.push(
          paragraph(`Not picked up by the deadline (${settings.pickup_deadline_hour}:00, ${settings.pickup_deadline_days} day after the order, exchange or return was raised):`),
          listTable(
            ['Order', 'Type', 'Raised', 'Pickup due', 'Customer', 'City'],
            latePickups.map((s) => [
              s.shipment_ref,
              SHIPMENT_KIND_LABELS[shipmentKind(s.shipment_ref)],
              displayDate(s.raised_date ?? s.order_date),
              displayDate(s.pickupDue),
              s.customer_name || '—',
              s.city || '—',
            ])
          )
        );
      }
      if (delayed.length) {
        sections.push(paragraph('Past the delivery deadline:'), listTable(delayHeaders, delayRows(delayed)));
      }

      const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
      const subjectParts = [
        escalated.length ? `${escalated.length} escalated for RTO` : null,
        latePickups.length ? plural(latePickups.length, 'late pickup', 'late pickups') : null,
        delayed.length ? plural(delayed.length, 'delayed delivery', 'delayed deliveries') : null,
      ].filter(Boolean);

      const response = await sendResendEmail({
        apiKey: resendApiKey,
        from: fromEmail,
        to: teamEmails,
        subject: `Shipment alert: ${subjectParts.join(', ')}`,
        html: wrapEmail('Shipments that need attention', '', sections.join('')),
      });

      if (response.ok) {
        const sentAt = new Date().toISOString();
        const mark = (list: any[], column: string) =>
          list.length ? supabase.from('order_shipments').update({ [column]: sentAt }).in('id', list.map((s) => s.id)) : null;
        await Promise.all([
          mark(latePickups, 'pickup_alert_sent_at'),
          mark(delayed, 'delay_alert_sent_at'),
          mark(escalated, 'escalation_alert_sent_at'),
        ]);
        results.latePickups = latePickups.length;
        results.delayed = delayed.length;
        results.escalated = escalated.length;
      } else {
        console.error('shipment-alerts: team digest failed', response.status, await response.text());
      }
    }

    // ── Customer apology ────────────────────────
    const smsReady = settings.notify_customers_by_sms && msg91AuthKey && msg91TemplateId;
    if (settings.notify_customers_by_sms && !smsReady) {
      console.error('shipment-alerts: SMS apology is on but MSG91_AUTH_KEY / MSG91_APOLOGY_TEMPLATE_ID are not set');
    }
    const inHours = now.hour >= CUSTOMER_MESSAGE_HOURS.from && now.hour < CUSTOMER_MESSAGE_HOURS.to;

    if ((settings.notify_customers_by_email || smsReady) && inHours) {
      // The apology is about a late delivery to the customer, so returns
      // (coming back from them) are left to the team.
      const toNotify = tracked.filter(
        (s) =>
          !s.customer_notified &&
          (s.check === 'DELAYED_NOTIFY' || s.check === 'ESCALATED') &&
          shipmentKind(s.shipment_ref) !== 'RETURN'
      );

      for (const s of toNotify) {
        const sent: string[] = [];
        const mobile = indianMobile(s.customer_phone);

        if (smsReady && mobile) {
          const smsError = await sendApologySms(msg91AuthKey, msg91TemplateId, mobile, s);
          if (smsError) console.error(`shipment-alerts: SMS to ${s.shipment_ref} failed:`, smsError);
          else sent.push('SMS');
        }

        if (settings.notify_customers_by_email && s.customer_email) {
          const response = await sendResendEmail({
            apiKey: resendApiKey,
            from: customerFrom,
            to: [s.customer_email],
            subject: `An update on your ${storeName} order ${s.order_name}`,
            html: apologyEmail(s, storeName),
          });
          if (response.ok) sent.push('EMAIL');
          else console.error(`shipment-alerts: email to ${s.shipment_ref} failed`, response.status, await response.text());
        }

        if (sent.length) {
          await supabase
            .from('order_shipments')
            .update({ customer_notified: true, notified_on: now.date, notified_via: sent[0] })
            .eq('id', s.id);
          results.customersNotified++;
        } else {
          // Send failed or no usable phone / email; retried next hour.
          results.customersNotReached++;
        }
      }
    }

    console.log('shipment-alerts:', JSON.stringify(results));
    return json({ success: true, ...results });
  } catch (error) {
    console.error('shipment-alerts error:', error);
    return json({ error: error.message }, 500);
  }
});
