-- idx_shipments_warehouse_id (dropped in 20261021140000) was the covering index for
-- the shipments_warehouse_id_fkey foreign key. Put a plain index back so deletes on
-- warehouses do not scan shipments (lint 0001 unindexed_foreign_keys).
CREATE INDEX IF NOT EXISTS idx_shipments_warehouse_id ON public.shipments (warehouse_id);
