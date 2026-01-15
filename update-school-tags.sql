-- Update existing products to include SNS and TKHS school tags
UPDATE public.product_catalog 
SET school_tags = ARRAY['All Schools', 'SNS', 'TKHS']
WHERE school_tags = ARRAY['All Schools'];

-- Verify the update
SELECT sku, product_name, school_tags FROM public.product_catalog WHERE active = true;
