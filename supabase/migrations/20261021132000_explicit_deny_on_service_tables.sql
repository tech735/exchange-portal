-- These tables are written by a backend that uses the service role (which bypasses
-- RLS). Make the "no API access" intent explicit with a deny policy, so it is not
-- mistaken for a forgotten policy (advisor lint 0008 rls_enabled_no_policy).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'warehouses', 'warehouse_receipts', 'warehouse_receipt_items',
    'shipments', 'shipment_packages', 'shipment_tracking_events',
    'shopify_orders', 'provider_wallet_balances',
    'exchange_activity_logs', 'logistics_api_logs'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role_only', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        t || '_service_role_only', t
      );
    END IF;
  END LOOP;
END $$;
