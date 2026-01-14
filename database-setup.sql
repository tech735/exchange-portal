-- Complete Database Setup for Exchange Flow App
-- Run this in your Supabase SQL Editor: https://supabase.co/dashboard/project/krganrlvkxghgmztcong/sql

-- Step 1: Create Enums
CREATE TYPE ticket_stage AS ENUM (
  'LODGED', 'WAREHOUSE_PENDING', 'WAREHOUSE_APPROVED', 'WAREHOUSE_DENIED',
  'EXCHANGE_COMPLETED', 'INVOICING_PENDING', 'INVOICED', 'CLOSED', 'ESCALATED'
);

CREATE TYPE ticket_status AS ENUM (
  'NEW', 'IN_PROCESS', 'COMPLETED', 'DENIED', 'ESCALATED'
);

CREATE TYPE reason_code AS ENUM (
  'WRONG_SIZE', 'DEFECTIVE', 'WRONG_ITEM', 'CHANGED_MIND', 'QUALITY_ISSUE', 'OTHER'
);

-- Step 2: Create Product Catalog Table
CREATE TABLE product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  product_description TEXT,
  category TEXT,
  variants JSONB DEFAULT '[]'::jsonb,
  school_tags TEXT[],
  price DECIMAL(10,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 3: Create Tickets Table
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  student_name TEXT,
  student_grade TEXT,
  student_section TEXT,
  school_name TEXT,
  reason_code reason_code NOT NULL,
  reason_notes TEXT,
  stage ticket_stage NOT NULL DEFAULT 'LODGED',
  status ticket_status NOT NULL DEFAULT 'NEW',
  return_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  exchange_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  sla_breached BOOLEAN DEFAULT false,
  sla_breached_at TIMESTAMPTZ,
  assigned_team TEXT DEFAULT 'support',
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lodged_at TIMESTAMPTZ DEFAULT now(),
  warehouse_received_at TIMESTAMPTZ,
  warehouse_approved_at TIMESTAMPTZ,
  warehouse_denied_at TIMESTAMPTZ,
  exchange_completed_at TIMESTAMPTZ,
  sent_to_invoicing_at TIMESTAMPTZ,
  invoicing_done_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 4: Create Ticket Events Table (for audit log)
CREATE TABLE ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_by_user_id UUID,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_payload JSONB DEFAULT '{}'::jsonb
);

-- Step 5: Create Google Sheets Sync Table
CREATE TABLE google_sheets_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',
  total_rows INTEGER DEFAULT 0,
  synced_rows INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 6: Create Indexes for Performance
CREATE INDEX idx_tickets_order_id ON tickets(order_id);
CREATE INDEX idx_tickets_stage ON tickets(stage);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_customer_phone ON tickets(customer_phone);
CREATE INDEX idx_tickets_sla_breached ON tickets(sla_breached);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_product_catalog_sku ON product_catalog(sku);
CREATE INDEX idx_product_catalog_active ON product_catalog(active);
CREATE INDEX idx_ticket_events_ticket_id ON ticket_events(ticket_id);

-- Step 7: Insert Sample Products (you can replace these with your Google Sheets data)
INSERT INTO product_catalog (sku, product_name, product_description, category, variants, school_tags, price) VALUES
  ('SHIRT-WHT-001', 'White School Shirt', 'Classic white school shirt with school logo', 'Uniforms', '["XS", "S", "M", "L", "XL", "XXL"]', ARRAY['All Schools'], 25.99),
  ('SKIRT-NVY-001', 'Navy Blue Skirt', 'Navy blue school skirt with adjustable waist', 'Uniforms', '["XS", "S", "M", "L", "XL"]', ARRAY['All Schools'], 35.99),
  ('PANT-NVY-001', 'Navy Blue Trousers', 'Navy blue school trousers', 'Uniforms', '["24", "26", "28", "30", "32", "34", "36"]', ARRAY['All Schools'], 45.99),
  ('BLZR-NVY-001', 'Navy Blue Blazer', 'Navy blue blazer with school emblem', 'Uniforms', '["XS", "S", "M", "L", "XL", "XXL"]', ARRAY['All Schools'], 89.99),
  ('SHOE-BLK-001', 'Black School Shoes', 'Formal black school shoes', 'Footwear', '["3", "4", "5", "6", "7", "8", "9", "10"]', ARRAY['All Schools'], 55.99),
  ('SOCK-WHT-001', 'White School Socks', 'Pack of 3 white school socks', 'Accessories', '["S", "M", "L"]', ARRAY['All Schools'], 12.99),
  ('TIE-STR-001', 'Striped School Tie', 'School striped tie', 'Accessories', '["Standard"]', ARRAY['All Schools'], 15.99),
  ('BELT-BLK-001', 'Black Leather Belt', 'Black leather school belt', 'Accessories', '["S", "M", "L", "XL"]', ARRAY['All Schools'], 18.99),
  ('BAG-NVY-001', 'Navy School Backpack', 'Navy blue school backpack', 'Bags', '["Standard"]', ARRAY['All Schools'], 42.99),
  ('SPORT-WHT-001', 'White Sports T-Shirt', 'White sports t-shirt for PE', 'Sports', '["XS", "S", "M", "L", "XL"]', ARRAY['All Schools'], 22.99);

-- Step 8: Create Function to Update Timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create Triggers for Updated At
CREATE TRIGGER update_product_catalog_updated_at
  BEFORE UPDATE ON product_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_sheets_sync_updated_at
  BEFORE UPDATE ON google_sheets_sync
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 10: Verify Setup
SELECT 
  'Setup Complete' as status,
  'Tables created successfully' as message,
  now() as completed_at;
