-- Exchange and return shipments on the Shipments page.
--
-- A shipment's kind comes from its ref (see shipmentKind in
-- supabase/functions/_shared/shipmentRules.ts): <order>-F2 and later are
-- exchanges sent out, <order>-R1 … are returns pulled from Shopify by the
-- shopify syncShipments action. Their deadlines count from the day they were
-- raised, not from the original order, so they get their own date.

ALTER TABLE public.order_shipments
  -- Day the exchange fulfillment / return was created; NULL for an order's
  -- first shipment, whose deadlines count from order_date.
  ADD COLUMN raised_date DATE;

CREATE INDEX IF NOT EXISTS order_shipments_raised_date_idx ON public.order_shipments (raised_date DESC);
