-- Add Shopify tracking columns to product_catalog
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS shopify_product_id BIGINT,
  ADD COLUMN IF NOT EXISTS shopify_variant_id BIGINT,
  ADD COLUMN IF NOT EXISTS product_description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Index for fast lookups during upsert
CREATE INDEX IF NOT EXISTS idx_product_catalog_shopify_variant
  ON public.product_catalog(shopify_variant_id);

-- Allow service-role (edge functions) to upsert products
-- The existing RLS policy "Admin can manage products" handles admin,
-- but edge functions use the service-role key which bypasses RLS.
