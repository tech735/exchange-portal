-- Outbound shipment tracker — replaces the "Ecom Order Tracker" Google Sheet.
--
-- Not to be confused with public.shipments, which belongs to the logistics
-- functions (aggregator bookings for exchange tickets). The tables here are
-- deliberately created without IF NOT EXISTS so a name clash fails loudly.
--
-- One row per Shopify fulfillment (a parcel with its own AWB). An order that
-- has not been fulfilled yet gets a single placeholder row keyed
-- '<order_id>:pending' so it shows up as "Awaiting Pickup"; the sync re-keys
-- that row to the first fulfillment once one exists, keeping any notes or
-- notification flags the team already added.
--
-- Rows are filled by the `shopify` Edge Function (action: syncShipments) and
-- edited by the team in the Shipments page. The time-based checks (On Track /
-- Delayed – Notify Now / Delivered Late …) are derived from these dates and
-- the deadlines in order_shipment_settings by supabase/functions/_shared/shipmentRules.ts,
-- which both the app and the shipment-alerts function use.

-- ─────────────────────────────────────────────
-- Settings (single row, editable from the Shipments page)
-- ─────────────────────────────────────────────
CREATE TABLE public.order_shipment_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ncr_delivery_days INT NOT NULL DEFAULT 2 CHECK (ncr_delivery_days >= 0),
  outside_ncr_delivery_days INT NOT NULL DEFAULT 4 CHECK (outside_ncr_delivery_days >= 0),
  -- Pickup is due by pickup_deadline_hour (IST, 24h) this many days after the order.
  pickup_deadline_days INT NOT NULL DEFAULT 1 CHECK (pickup_deadline_days >= 0),
  pickup_deadline_hour INT NOT NULL DEFAULT 13 CHECK (pickup_deadline_hour BETWEEN 0 AND 23),
  skip_sundays BOOLEAN NOT NULL DEFAULT TRUE,
  -- Undelivered this many days past the delivery deadline -> flagged for an
  -- RTO decision. RTO itself is always set by hand.
  rto_escalation_days INT NOT NULL DEFAULT 3 CHECK (rto_escalation_days >= 1),
  -- A city or state containing any of these names is Delhi NCR.
  ncr_cities TEXT[] NOT NULL DEFAULT ARRAY[
    'delhi', 'gurgaon', 'gurugram', 'noida', 'greater noida', 'ghaziabad', 'faridabad'
  ],
  ncr_pincode_prefixes TEXT[] NOT NULL DEFAULT ARRAY['110', '1220', '1210', '2010', '2013'],
  -- Late-pickup / delayed-order digest. Empty = LOGISTICS_NOTIFICATION_EMAILS + ADMIN_NOTIFICATION_EMAIL.
  team_alert_emails TEXT[] NOT NULL DEFAULT '{}',
  -- Automatic apology to customers past the delivery deadline. Both off
  -- until the wording (and the MSG91 DLT template for SMS) is signed off.
  notify_customers_by_email BOOLEAN NOT NULL DEFAULT FALSE,
  notify_customers_by_sms BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.order_shipment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- Shipments
-- ─────────────────────────────────────────────
CREATE TABLE public.order_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- '<shopify_order_id>:<fulfillment_id>' / '<shopify_order_id>:pending' for
  -- synced rows, 'manual:<uuid>' for rows added by hand or imported.
  shipment_key TEXT NOT NULL UNIQUE DEFAULT ('manual:' || gen_random_uuid()::text),
  source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('SHOPIFY', 'MANUAL')),
  shopify_order_id BIGINT,
  shopify_fulfillment_id BIGINT,

  order_name TEXT NOT NULL,          -- Shopify order name, e.g. K-2627-3239
  shipment_ref TEXT NOT NULL,        -- order name, suffixed -F2, -F3 … for split shipments
  order_date DATE NOT NULL,

  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  delivery_zone TEXT NOT NULL DEFAULT 'OUTSIDE_NCR' CHECK (delivery_zone IN ('DELHI_NCR', 'OUTSIDE_NCR')),

  courier TEXT,
  awb_number TEXT,
  tracking_url TEXT,

  status TEXT NOT NULL DEFAULT 'AWAITING_PICKUP' CHECK (status IN (
    'AWAITING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RTO', 'CANCELLED'
  )),
  courier_status TEXT,               -- raw Shopify shipment_status, for reference
  pickup_date DATE,
  -- Set only when the courier's promised date should replace the SLA rule;
  -- NULL means the deadline comes from pickup date + zone.
  expected_delivery_date DATE,
  delivered_date DATE,

  customer_notified BOOLEAN NOT NULL DEFAULT FALSE,
  notified_on DATE,
  notified_via TEXT CHECK (notified_via IN ('EMAIL', 'WHATSAPP', 'SMS', 'CALL')),
  notes TEXT,

  -- RTO / special cases stay open until resolved_on is set.
  resolution TEXT,
  resolved_on DATE,

  -- Team digest guards: each shipment is reported once per problem.
  pickup_alert_sent_at TIMESTAMPTZ,
  delay_alert_sent_at TIMESTAMPTZ,
  escalation_alert_sent_at TIMESTAMPTZ,

  -- Columns the team edited by hand; the Shopify sync never overwrites these.
  manual_overrides TEXT[] NOT NULL DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_shipments_order_date_idx ON public.order_shipments (order_date DESC);
CREATE INDEX IF NOT EXISTS order_shipments_status_idx ON public.order_shipments (status);
CREATE INDEX IF NOT EXISTS order_shipments_shopify_order_id_idx ON public.order_shipments (shopify_order_id);
CREATE INDEX IF NOT EXISTS order_shipments_order_name_idx ON public.order_shipments (order_name);

-- "Zone is set from City": Delhi NCR when the city or state contains one of
-- the configured NCR names (so "Central Delhi", "Gurgaon" both resolve) or the
-- PIN code starts with a configured prefix.
CREATE OR REPLACE FUNCTION public.order_shipment_delivery_zone(p_city TEXT, p_state TEXT, p_pincode TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.order_shipment_settings s, unnest(s.ncr_cities) AS name
      WHERE s.id = 1
        AND trim(name) <> ''
        AND (lower(coalesce(p_city, '')) LIKE '%' || lower(trim(name)) || '%'
          OR lower(coalesce(p_state, '')) LIKE '%' || lower(trim(name)) || '%')
    ) THEN 'DELHI_NCR'
    WHEN EXISTS (
      SELECT 1
      FROM public.order_shipment_settings s, unnest(s.ncr_pincode_prefixes) AS prefix
      WHERE s.id = 1
        AND trim(prefix) <> ''
        AND regexp_replace(coalesce(p_pincode, ''), '\s', '', 'g') LIKE trim(prefix) || '%'
    ) THEN 'DELHI_NCR'
    ELSE 'OUTSIDE_NCR'
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_order_shipment_derived_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT ('delivery_zone' = ANY (NEW.manual_overrides)) THEN
    NEW.delivery_zone := public.order_shipment_delivery_zone(NEW.city, NEW.state, NEW.pincode);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_order_shipment_derived_fields ON public.order_shipments;
CREATE TRIGGER set_order_shipment_derived_fields
  BEFORE INSERT OR UPDATE ON public.order_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_shipment_derived_fields();

CREATE OR REPLACE FUNCTION public.touch_order_shipment_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Editing the NCR list re-derives the zone of every shipment not set by
-- hand. AFTER the settings row is written, so the zone function reads the
-- new lists.
CREATE OR REPLACE FUNCTION public.rederive_order_shipment_zones()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.order_shipments
  SET delivery_zone = delivery_zone -- the BEFORE trigger recomputes it
  WHERE NOT ('delivery_zone' = ANY (manual_overrides));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS touch_order_shipment_settings ON public.order_shipment_settings;
CREATE TRIGGER touch_order_shipment_settings
  BEFORE UPDATE ON public.order_shipment_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_order_shipment_settings();

DROP TRIGGER IF EXISTS rederive_order_shipment_zones ON public.order_shipment_settings;
CREATE TRIGGER rederive_order_shipment_zones
  AFTER UPDATE OF ncr_cities, ncr_pincode_prefixes ON public.order_shipment_settings
  FOR EACH ROW
  WHEN (NEW.ncr_cities IS DISTINCT FROM OLD.ncr_cities
        OR NEW.ncr_pincode_prefixes IS DISTINCT FROM OLD.ncr_pincode_prefixes)
  EXECUTE FUNCTION public.rederive_order_shipment_zones();

-- Same access model as tickets / product_catalog (see
-- 20260401180000_disable_rls_all.sql).
ALTER TABLE public.order_shipments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_shipment_settings DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_shipments TO authenticated, anon, service_role;
GRANT SELECT, UPDATE ON public.order_shipment_settings TO authenticated, anon, service_role;

-- ─────────────────────────────────────────────
-- Hourly jobs. Reuse the vault secrets from
-- 20260708090000_add_ticket_escalation_cron.sql.
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- :15 — pull new orders / fulfillments / courier status from Shopify.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-shopify-shipments';
SELECT cron.schedule(
  'sync-shopify-shipments',
  '15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_functions_url') || '/shopify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"action": "syncShipments"}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_functions_url')
  $$
);

-- :30 — team alerts for late pickups / delayed orders, and (when enabled in
-- settings) the customer apology email. Runs after the sync so it sees fresh
-- statuses.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'shipment-alerts';
SELECT cron.schedule(
  'shipment-alerts',
  '30 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_functions_url') || '/shipment-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_functions_url')
  $$
);
