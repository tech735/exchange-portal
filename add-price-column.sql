-- Add price column to product_catalog table if it doesn't exist
ALTER TABLE product_catalog 
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);

-- Update existing products with sample prices if price is null
UPDATE product_catalog 
SET price = CASE 
  WHEN sku LIKE '%SHIRT%' THEN 25.99
  WHEN sku LIKE '%SKIRT%' THEN 35.99
  WHEN sku LIKE '%PANT%' THEN 45.99
  WHEN sku LIKE '%BLZR%' THEN 89.99
  WHEN sku LIKE '%SHOE%' THEN 55.99
  WHEN sku LIKE '%SOCK%' THEN 12.99
  WHEN sku LIKE '%TIE%' THEN 15.99
  WHEN sku LIKE '%BELT%' THEN 18.99
  WHEN sku LIKE '%BAG%' THEN 42.99
  WHEN sku LIKE '%SPORT%' THEN 22.99
  ELSE 30.00
END
WHERE price IS NULL;

-- Verify the changes
SELECT sku, product_name, price FROM product_catalog WHERE active = true;
