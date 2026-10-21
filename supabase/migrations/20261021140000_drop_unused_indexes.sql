-- Drop indexes the Performance Advisor reports as never used (lint 0005).
-- Index stats on this project have never been reset, so "never used" covers all
-- production traffic since January 2026. No query in this app filters on these
-- columns in a way an index can serve:
--   * order_shipments raised_date/status only appear inside an OR together with a
--     NOT IN branch, which forces a sequential scan anyway.
--   * the tickets AWB / tracking-status / sla_breached columns are never searched.
-- Recreate any of them with CREATE INDEX if a new query needs it.
--
-- The foreign key indexes from 20261021130000 are kept on purpose: dropping them
-- brings back lint 0001 (unindexed_foreign_keys), and idx_logistics_api_logs_shipment_id
-- stops a full scan of logistics_api_logs whenever a shipment is deleted.

DROP INDEX IF EXISTS public.order_shipments_raised_date_idx;
DROP INDEX IF EXISTS public.order_shipments_status_idx;

DROP INDEX IF EXISTS public.idx_tickets_sla_breached;
DROP INDEX IF EXISTS public.idx_tickets_return_tracking_status;
DROP INDEX IF EXISTS public.idx_tickets_return_awb;
DROP INDEX IF EXISTS public.idx_tickets_exchange_awb;

DROP INDEX IF EXISTS public.idx_product_catalog_shopify_variant;

DROP INDEX IF EXISTS public.idx_reverse_shipments_provider_shipment_id;
DROP INDEX IF EXISTS public.idx_reverse_shipments_provider_order_id;
DROP INDEX IF EXISTS public.idx_reverse_shipments_status;
DROP INDEX IF EXISTS public.idx_shipments_sub_order_id;
DROP INDEX IF EXISTS public.idx_shipments_warehouse_id;
DROP INDEX IF EXISTS public.idx_tracking_events_event_at;
DROP INDEX IF EXISTS public.idx_warehouse_receipts_awb;
DROP INDEX IF EXISTS public.idx_activity_logs_created_at;
DROP INDEX IF EXISTS public.idx_shopify_orders_customer_phone;
DROP INDEX IF EXISTS public.idx_warehouses_active;
