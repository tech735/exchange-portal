import { useCallback } from 'react';
import { useUpdateTicket } from '@/hooks/useTickets';
import { useProductPrices } from '@/hooks/useProductPrices';
import { useAppSettings } from '@/hooks/useAppData';
import { computeExchangeAmounts } from '@/lib/exchangeMath';
import type { Ticket } from '@/types/database';

/**
 * Shared exchange actions so the list, detail page and dashboard queue all
 * write exactly the same fields (compatible with the existing data model).
 */
export function useExchangeActions() {
  const update = useUpdateTicket();
  const { data: prices } = useProductPrices();
  const { data: settings } = useAppSettings();

  const amountsFor = useCallback(
    (t: Ticket) =>
      computeExchangeAmounts(t, prices as Record<string, number> | undefined, {
        deliveryCharge: settings?.fees.delivery_charge ?? 150,
        freeReasons: settings?.fees.free_reasons,
      }),
    [prices, settings],
  );

  /** Record that the customer paid (or that a refund is due) → moves to warehouse. */
  const settlePayment = useCallback(
    async (t: Ticket) => {
      const a = amountsFor(t);
      await update.mutateAsync({
        id: t.id,
        stage: 'LODGED',
        status: 'COMPLETED',
        amount_collected: a.net > 0 ? a.net : 0,
        refund_amount: a.net < 0 ? Math.abs(a.net) : 0,
        delivery_charge: a.deliveryCharge,
        exchange_completed_at: new Date().toISOString(),
        is_paid: true,
        eventType: 'UPDATED',
      });
      return a;
    },
    [amountsFor, update],
  );

  /** Payment link sent (link itself is created in Razorpay for now). */
  const markLinkSent = useCallback(
    (t: Ticket) => update.mutateAsync({ id: t.id, status: 'IN_PROCESS', eventType: 'UPDATED' }),
    [update],
  );

  type Agg = 'SHIPDELIGHT' | 'ITHINK' | 'SHIPROCKET';

  /** Warehouse steps — same fields the old Warehouse page wrote. */
  const bookReturn = useCallback(
    (t: Ticket, aggregator: Agg, awb: string) =>
      update.mutateAsync({ id: t.id, stage: 'RETURN_PENDING', return_aggregator: aggregator, return_awb: awb, return_booked_at: new Date().toISOString(), eventType: 'UPDATED' }),
    [update],
  );
  const markReceived = useCallback(
    (t: Ticket) => update.mutateAsync({ id: t.id, stage: 'RETURN_RECEIVED', return_received_at: new Date().toISOString(), eventType: 'RECEIVED' }),
    [update],
  );
  const recordQc = useCallback(
    (t: Ticket, decision: 'APPROVED' | 'DENIED', notes: string, checklist: Record<string, boolean>, photos: string[]) =>
      update.mutateAsync({
        id: t.id,
        stage: decision === 'APPROVED' ? 'WAREHOUSE_APPROVED' : 'WAREHOUSE_DENIED',
        qc_decision: decision,
        qc_notes: notes,
        qc_checklist: checklist,
        qc_photos: photos,
        ...(decision === 'APPROVED' ? { warehouse_approved_at: new Date().toISOString() } : { warehouse_denied_at: new Date().toISOString() }),
        eventType: decision === 'APPROVED' ? 'APPROVED' : 'DENIED',
      }),
    [update],
  );
  const bookReplacement = useCallback(
    (t: Ticket, aggregator: Agg, awb: string) =>
      update.mutateAsync({ id: t.id, stage: 'EXCHANGE_BOOKED', status: 'COMPLETED', exchange_aggregator: aggregator, exchange_awb: awb, exchange_booked_at: new Date().toISOString(), eventType: 'EXCHANGE_DONE' }),
    [update],
  );

  /**
   * Undo the most recent warehouse step: puts the ticket back where it was and
   * clears what that step recorded. Returns false if there's nothing to undo.
   */
  const stepBack = useCallback(
    async (t: Ticket) => {
      switch (t.stage) {
        case 'RETURN_PENDING': // pickup booked → to book
          await update.mutateAsync({ id: t.id, stage: 'LODGED', return_aggregator: null, return_awb: null, return_booked_at: null, eventType: 'UPDATED' });
          return true;
        case 'RETURN_RECEIVED': // received → in transit
          await update.mutateAsync({ id: t.id, stage: 'RETURN_PENDING', return_received_at: null, eventType: 'UPDATED' });
          return true;
        case 'WAREHOUSE_APPROVED':
        case 'WAREHOUSE_DENIED': // QC decided → QC pending
          await update.mutateAsync({ id: t.id, stage: 'RETURN_RECEIVED', qc_decision: null, qc_notes: null, qc_checklist: null, qc_photos: [], warehouse_approved_at: null, warehouse_denied_at: null, eventType: 'UPDATED' });
          return true;
        case 'EXCHANGE_BOOKED': // replacement booked → ready to ship
          await update.mutateAsync({ id: t.id, stage: 'WAREHOUSE_APPROVED', exchange_aggregator: null, exchange_awb: null, exchange_booked_at: null, eventType: 'UPDATED' });
          return true;
        default:
          return false;
      }
    },
    [update],
  );

  return { amountsFor, settlePayment, markLinkSent, bookReturn, markReceived, recordQc, bookReplacement, stepBack, update, pending: update.isPending };
}

export const RAZORPAY_LINKS_URL =
  'https://dashboard.razorpay.com/app/paymentlinks';
