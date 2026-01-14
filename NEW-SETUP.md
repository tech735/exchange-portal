# 🆕 Fresh Database Setup Guide

## ✅ Old Connection Removed
All previous database connections have been cleaned up:
- ❌ Old .env file deleted
- ❌ Old supabase folder removed  
- ❌ Old test files removed

## 🚀 Setting Up New Database Connection

### Step 1: Create New Supabase Project
1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Choose your organization
4. **Project Name**: `exchange-flow-app`
5. **Database Password**: Create a strong password (save it!)
6. **Region**: Choose closest to your location
7. Click **"Create new project"**
8. Wait for setup to complete (2-3 minutes)

### Step 2: Get Your Credentials
Once project is ready:
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://[project-id].supabase.co`
   - **anon/public key**: The long JWT token

### Step 3: Update Your .env File
Replace the placeholder values in `.env`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Set Up Database Tables
Go to **SQL Editor** in your new Supabase project and run:

```sql
-- Create all required tables for Exchange Flow App

-- Create enums
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

-- Create tickets table (NO RLS to avoid errors)
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  student_name TEXT,
  student_grade TEXT,
  student_section TEXT,
  reason_code reason_code NOT NULL,
  reason_notes TEXT,
  stage ticket_stage NOT NULL DEFAULT 'LODGED',
  status ticket_status NOT NULL DEFAULT 'NEW',
  return_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  exchange_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create product catalog table
CREATE TABLE product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  variants JSONB DEFAULT '[]'::jsonb,
  school_tags TEXT[],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert sample products
INSERT INTO product_catalog (sku, product_name, variants, school_tags) VALUES
  ('SHIRT-WHT-001', 'White School Shirt', '["XS", "S", "M", "L", "XL", "XXL"]', ARRAY['All Schools']),
  ('SKIRT-NVY-001', 'Navy Blue Skirt', '["XS", "S", "M", "L", "XL"]', ARRAY['All Schools']),
  ('PANT-NVY-001', 'Navy Blue Trousers', '["24", "26", "28", "30", "32", "34", "36"]', ARRAY['All Schools']);
```

### Step 5: Test Your New Connection
1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:5173
3. Try creating a ticket - it should work now!

## 🔧 If You Need Help
- Check that your .env file has the correct URL and key
- Ensure your Supabase project is active (not paused)
- Verify tables were created in Supabase Table Editor

## 🎉 Done!
Your app now has a fresh, clean database connection without any old configuration issues.
