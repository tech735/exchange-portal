-- Create product catalog table with prices
CREATE TABLE IF NOT EXISTS public.product_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  product_description TEXT,
  category TEXT,
  variants JSONB DEFAULT '[]'::jsonb,
  school_tags TEXT[],
  price DECIMAL(10,2) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_product_catalog_sku ON public.product_catalog(sku);
CREATE INDEX IF NOT EXISTS idx_product_catalog_active ON public.product_catalog(active);

-- Enable RLS
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can view active products
CREATE POLICY "Anyone can view active products" ON public.product_catalog
  FOR SELECT USING (active = true);

-- Admin can manage products
CREATE POLICY "Admin can manage products" ON public.product_catalog
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_product_catalog_updated_at
  BEFORE UPDATE ON public.product_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_product_catalog_updated_at();

-- Insert sample products (you can replace these with your actual data)
INSERT INTO public.product_catalog (sku, product_name, product_description, category, variants, school_tags, price) VALUES
  ('SHIRT-WHT-001', 'White School Shirt', 'Classic white school shirt with school logo', 'Uniforms', '["XS", "S", "M", "L", "XL", "XXL"]', ARRAY['All Schools', 'SNS', 'TKHS'], 25.99),
  ('SKIRT-NVY-001', 'Navy Blue Skirt', 'Navy blue school skirt with adjustable waist', 'Uniforms', '["XS", "S", "M", "L", "XL"]', ARRAY['All Schools', 'SNS', 'TKHS'], 35.99),
  ('PANT-NVY-001', 'Navy Blue Trousers', 'Navy blue school trousers', 'Uniforms', '["24", "26", "28", "30", "32", "34", "36"]', ARRAY['All Schools', 'SNS', 'TKHS'], 45.99),
  ('BLZR-NVY-001', 'Navy Blue Blazer', 'Navy blue blazer with school emblem', 'Uniforms', '["XS", "S", "M", "L", "XL", "XXL"]', ARRAY['All Schools', 'SNS', 'TKHS'], 89.99),
  ('SHOE-BLK-001', 'Black School Shoes', 'Formal black school shoes', 'Footwear', '["3", "4", "5", "6", "7", "8", "9", "10"]', ARRAY['All Schools', 'SNS', 'TKHS'], 55.99),
  ('SOCK-WHT-001', 'White School Socks', 'Pack of 3 white school socks', 'Accessories', '["S", "M", "L"]', ARRAY['All Schools', 'SNS', 'TKHS'], 12.99),
  ('TIE-STR-001', 'Striped School Tie', 'School striped tie', 'Accessories', '["Standard"]', ARRAY['All Schools', 'SNS', 'TKHS'], 15.99),
  ('BELT-BLK-001', 'Black Leather Belt', 'Black leather school belt', 'Accessories', '["S", "M", "L", "XL"]', ARRAY['All Schools', 'SNS', 'TKHS'], 18.99),
  ('BAG-NVY-001', 'Navy School Backpack', 'Navy blue school backpack', 'Bags', '["Standard"]', ARRAY['All Schools', 'SNS', 'TKHS'], 42.99),
  ('SPORT-WHT-001', 'White Sports T-Shirt', 'White sports t-shirt for PE', 'Sports', '["XS", "S", "M", "L", "XL"]', ARRAY['All Schools', 'SNS', 'TKHS'], 22.99)
ON CONFLICT (sku) DO NOTHING;
