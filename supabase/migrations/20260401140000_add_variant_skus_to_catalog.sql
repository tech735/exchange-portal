-- Migration to store all variant SKUs for grouped products
ALTER TABLE public.product_catalog ADD COLUMN IF NOT EXISTS variant_skus TEXT[] DEFAULT '{}';
