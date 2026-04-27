-- Add variant_prices column to product_catalog to store individual variant prices
ALTER TABLE public.product_catalog ADD COLUMN IF NOT EXISTS variant_prices JSONB DEFAULT '{}'::jsonb;

-- Update the comment to describe the column
COMMENT ON COLUMN public.product_catalog.variant_prices IS 'Stores a mapping of variant SKU to price: {"SKU-1": 25.99, "SKU-2": 30.00}';
