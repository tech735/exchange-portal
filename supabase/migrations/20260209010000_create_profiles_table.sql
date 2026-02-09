-- Create profiles table for user management
-- This table is used throughout the application codebase
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'SUPPORT',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for email lookup
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;

-- RLS Policies with unique names
-- Users can view their own profile
CREATE POLICY "profiles_view_own" ON public.profiles
  FOR SELECT USING (auth.uid()::text = email);

-- Admin can view all profiles
CREATE POLICY "profiles_admin_view_all" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Admin can insert profiles
CREATE POLICY "profiles_admin_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Admin can update profiles
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Users can update their own profile (limited fields)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid()::text = email)
  WITH CHECK (auth.uid()::text = email);

-- Admin can delete profiles
CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at_trigger ON public.profiles;
DROP FUNCTION IF EXISTS update_profiles_updated_at();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_profiles_updated_at_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Insert default admin user
INSERT INTO public.profiles (email, full_name, role)
VALUES ('admin@kotu.com', 'System Admin', 'ADMIN')
ON CONFLICT (email) DO NOTHING;
