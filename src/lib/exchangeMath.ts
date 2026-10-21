import type { Ticket, TicketItem } from '@/types/database';

export interface ExchangeAmounts {
  returnValue: number;
  exchangeValue: number;
  deliveryCharge: number;
  /** Positive = customer pays, negative = refund due. */
  net: number;
  /** SKUs with no captured or catalogue price (shown as ₹0 and flagged). */
  missingPrices: string[];
}

/**
 * One calculation for every screen. Price order: price captured on the ticket
 * item → current catalogue price → 0 (flagged). Replaces the old mix of ₹1000
 * and ₹0 fallbacks that made screens disagree.
 */
export function computeExchangeAmounts(
  ticket: Pick<Ticket, 'return_items' | 'exchange_items' | 'delivery_charge' | 'reason_code'>,
  prices: Record<string, number> | undefined,
  defaults: { deliveryCharge: number; freeReasons?: string[] },
): ExchangeAmounts {
  const missing = new Set<string>();
  const value = (items: TicketItem[]) =>
    items.reduce((sum, it) => {
      const p = it.price ?? prices?.[it.sku];
      if (p === undefined || p === null) { missing.add(it.sku || it.product_name); return sum; }
      return sum + Number(p) * (it.qty || 1);
    }, 0);
  const returnValue = value(ticket.return_items || []);
  const exchangeValue = value(ticket.exchange_items || []);
  const free = defaults.freeReasons?.includes(ticket.reason_code);
  const deliveryCharge = ticket.delivery_charge ?? (free ? 0 : defaults.deliveryCharge);
  return { returnValue, exchangeValue, deliveryCharge, net: exchangeValue - returnValue + deliveryCharge, missingPrices: [...missing] };
}

export function itemPrice(it: TicketItem, prices?: Record<string, number>) {
  return it.price ?? prices?.[it.sku] ?? null;
}
