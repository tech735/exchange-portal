-- Product photos from Shopify for item thumbnails across the portal.
-- image_url: the product's main image; variant_images: variant SKU -> image URL
-- (falls back to image_url in the app when a variant has no image of its own).
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS variant_images JSONB NOT NULL DEFAULT '{}'::jsonb;
