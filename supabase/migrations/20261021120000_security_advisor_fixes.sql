-- Resolve the Supabase Security Advisor findings (2026-10-21).
--
-- Access model after this migration:
--   * anon (the public key in the JS bundle) can no longer read or write any app table.
--   * "Staff" = a signed-in Supabase Auth user that has a row in public.profiles.
--     Profiles are only created by the manage-users Edge Function, so a stranger who
--     signs up through Supabase Auth gets nothing.
--   * Admins (profiles.role = 'ADMIN') manage profiles.
--   * Tables this app does not use (warehouses, shipments, shopify_orders, ...) are
--     service-role only.
--   * Edge Functions and cron jobs use the service role key and bypass RLS, so they are
--     unaffected.
--
-- The fallback admin login (admin@kotu.com without a Supabase session) is removed from
-- the app in the same change. Make sure a real ADMIN exists before applying:
--   SELECT p.email, p.role FROM public.profiles p JOIN auth.users u ON u.id = p.id
--   WHERE upper(p.role) = 'ADMIN';

-- ---------------------------------------------------------------------------
-- 1. Role helpers in a schema that PostgREST does not expose, so they cannot be
--    called through /rest/v1/rpc (lints 0028 / 0029). SECURITY DEFINER lets them
--    read profiles from inside a profiles policy without recursion.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()));
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND upper(role) = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION private.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.is_staff(), private.is_admin(), private.user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_staff(), private.is_admin(), private.user_role() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Reset every policy on the tables touched here so the end state does not depend
--    on policies added from the dashboard (e.g. "Users can insert profile").
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'profiles', 'users',
        'tickets', 'ticket_events', 'product_catalog', 'google_sheets_sync',
        'order_shipments', 'order_shipment_settings', 'order_special_cases',
        'warehouses', 'warehouse_receipts', 'warehouse_receipt_items',
        'shipments', 'shipment_packages', 'shipment_tracking_events',
        'shopify_orders', 'provider_wallet_balances',
        'exchange_activity_logs', 'logistics_api_logs'
      ])
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. profiles: users see and edit their own row (but cannot change their own role);
--    admins manage everyone.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT private.is_admin()));

CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT private.is_admin()))
  WITH CHECK (
    (SELECT private.is_admin())
    OR (id = (SELECT auth.uid()) AND role = (SELECT private.user_role()))
  );

CREATE POLICY profiles_delete_admin ON public.profiles
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- Legacy public.users table, if it still exists: same rules, admin-managed.
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.users FROM anon;
    CREATE POLICY users_select ON public.users
      FOR SELECT TO authenticated
      USING (id = (SELECT auth.uid()) OR (SELECT private.is_admin()));
    CREATE POLICY users_admin_write ON public.users
      FOR ALL TO authenticated
      USING ((SELECT private.is_admin()))
      WITH CHECK ((SELECT private.is_admin()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. App tables the frontend reads and writes: staff only.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tickets', 'ticket_events', 'product_catalog', 'google_sheets_sync',
    'order_shipments', 'order_special_cases'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
        'USING ((SELECT private.is_staff())) WITH CHECK ((SELECT private.is_staff()))',
        t || '_staff_access', t
      );
    END IF;
  END LOOP;
END $$;

-- Single settings row (id = 1): staff read it and save it (the app upserts).
ALTER TABLE public.order_shipment_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_shipment_settings FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.order_shipment_settings TO authenticated;

CREATE POLICY order_shipment_settings_staff_read ON public.order_shipment_settings
  FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));

CREATE POLICY order_shipment_settings_staff_insert ON public.order_shipment_settings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_staff()));

CREATE POLICY order_shipment_settings_staff_update ON public.order_shipment_settings
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_staff()))
  WITH CHECK ((SELECT private.is_staff()));

-- ---------------------------------------------------------------------------
-- 5. Tables this app does not use: RLS on, no policies, no anon/authenticated
--    grants. Only the service role can reach them.
-- ---------------------------------------------------------------------------
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
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Old public SECURITY DEFINER helpers (callable via /rest/v1/rpc). Drop them now
--    that no policy above uses them. If some other policy still depends on one, keep
--    it but take it away from anon and say so.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.check_is_admin()', 'public.get_user_role()']
  LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      BEGIN
        EXECUTE format('DROP FUNCTION %s', fn);
      EXCEPTION WHEN dependent_objects_still_exist THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
        RAISE NOTICE '% is still used by another policy; kept it and revoked anon access', fn;
      END;
    END IF;
  END LOOP;
END $$;

-- Trigger function: triggers do not need EXECUTE, so nobody should be able to call it
-- through the API.
REVOKE EXECUTE ON FUNCTION public.notify_team_on_ticket_change() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Pin search_path on the flagged functions (lint 0011). The value matches the
--    project default, so the bodies resolve names exactly as before.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'update_profiles_updated_at', 'update_invitations_updated_at',
        'cleanup_expired_invitations', 'handle_updated_at',
        'generate_invitation_token', 'update_updated_at_column',
        'order_shipment_delivery_zone', 'set_order_shipment_derived_fields',
        'touch_order_shipment_settings', 'rederive_order_shipment_zones',
        'touch_order_special_case'
      ])
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', f);
  END LOOP;
END $$;

