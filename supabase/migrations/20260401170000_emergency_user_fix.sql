-- EMERGENCY UNLOCK: Fix 401/500 errors for Mock Auth environment
-- This script disables RLS to allow your app to work without a real sign-in session.

-- 1. Disable security checks (RLS) on user-related tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- If a separate users table exists, unlock it too
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 2. Ensure the admin user exists in the database
INSERT INTO public.profiles (email, full_name, role)
VALUES ('admin@kotu.com', 'System Admin', 'ADMIN')
ON CONFLICT (email) DO UPDATE SET role = 'ADMIN';

-- 3. Confirm access for your peace of mind
SELECT id, email, role FROM public.profiles;
