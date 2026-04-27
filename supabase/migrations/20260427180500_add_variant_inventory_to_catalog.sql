-- Add variant_inventory column to product_catalog to store individual variant inventory quantities
ALTER TABLE public.product_catalog ADD COLUMN IF NOT EXISTS variant_inventory JSONB DEFAULT '{}'::jsonb;

-- Update the comment to describe the column
COMMENT ON COLUMN public.product_catalog.variant_inventory IS 'Stores a mapping of variant SKU to available inventory quantity: {"SKU-1": 15, "SKU-2": 0}';
