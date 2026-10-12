-- Live courier tracking for the Shipments page.
--
-- Every 10 minutes the track-shipments Edge Function asks iThink Logistics /
-- ShipDelight for the status of each open shipment's AWB and moves it from
-- Awaiting Pickup through to Delivered. Rows start as Awaiting Pickup the
-- moment Shopify reports a fulfillment (see supabase/functions/shopify/shipments.ts).
--
-- Reuses the vault secrets from 20260708090000_add_ticket_escalation_cron.sql
-- and the aggregator secrets already set for the logistics functions:
--   ITHINK_API_BASE_URL, ITHINK_ACCESS_TOKEN, ITHINK_SECRET_KEY, SHIPDELIGHT_API_KEY

ALTER TABLE public.order_shipments
  -- Aggregator the AWB was found at; NULL until the first successful lookup.
  ADD COLUMN aggregator TEXT CHECK (aggregator IN ('ITHINK', 'SHIPDELIGHT')),
  -- Last failed lookup (AWB unknown to both, or the API call failed).
  ADD COLUMN tracking_error TEXT,
  ADD COLUMN tracking_error_at TIMESTAMPTZ;

COMMENT ON COLUMN public.order_shipments.courier_status IS
  'Courier''s own status text: from the aggregator once it is known, otherwise Shopify''s shipment_status.';

-- The Shipments page subscribes to row changes so status updates appear
-- without a reload.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_shipments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_shipments;
  END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- :00, :10, :20 … — clear of the Shopify sync at :15.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'track-shipments';
SELECT cron.schedule(
  'track-shipments',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_functions_url') || '/track-shipments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_functions_url')
  $$
);
