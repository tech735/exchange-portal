-- Resolve the Supabase Performance Advisor findings (2026-10-21).

-- ---------------------------------------------------------------------------
-- 1. multiple_permissive_policies: users_admin_write was FOR ALL, so it overlapped
--    users_select on SELECT. Give admins write-only policies instead.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_admin_write ON public.users;

CREATE POLICY users_admin_insert ON public.users
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY users_admin_update ON public.users
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY users_admin_delete ON public.users
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- ---------------------------------------------------------------------------
-- 2. unindexed_foreign_keys: index the referencing columns so joins and
--    ON DELETE checks on the parent do not scan the child table.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_logistics_api_logs_shipment_id ON public.logistics_api_logs (shipment_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_receipts_shipment_id ON public.warehouse_receipts (shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipments_package_id ON public.shipments (package_id);
CREATE INDEX IF NOT EXISTS idx_users_created_by ON public.users (created_by);

-- ---------------------------------------------------------------------------
-- 3. unused_index: drop only indexes that cannot help any query.
--    Kept on purpose: lookup indexes on order_shipments, tickets (AWBs),
--    product_catalog and the logistics tables. They show as unused because those
--    tables are still small enough for sequential scans, and they will be needed
--    as data grows.
-- ---------------------------------------------------------------------------
-- Duplicates of the UNIQUE (email) constraint indexes.
DROP INDEX IF EXISTS public.idx_profiles_email;
DROP INDEX IF EXISTS public.idx_users_email;
-- Only ever searched with ILIKE '%...%', which a btree index cannot serve.
DROP INDEX IF EXISTS public.idx_tickets_customer_phone;
-- Staff/user tables with a handful of rows, never filtered by these columns.
DROP INDEX IF EXISTS public.idx_profiles_role;
DROP INDEX IF EXISTS public.idx_profiles_invitation_id;
DROP INDEX IF EXISTS public.idx_users_role;
DROP INDEX IF EXISTS public.idx_users_active;
