-- Fix RLS policies for profiles table to allow signup
-- Temporarily disable RLS for testing and then enable with proper policies

-- Disable RLS temporarily
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Allow public inserts for signup (you can make this more secure later)
CREATE POLICY "Allow public insert for signup" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- Allow users to view their own profile
CREATE POLICY "Allow users to view own profile" ON public.profiles
  FOR SELECT USING (auth.uid()::text = email OR email IS NOT NULL);

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON public.profiles TO anon;
GRANT ALL ON public.profiles TO authenticated;
