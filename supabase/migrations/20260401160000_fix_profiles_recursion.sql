-- Final Fix for Profiles/Users 500 Internal Error (Infinite Recursion)
-- This migration replaces the recursive policies with safe, stable checks.

-- 1. Create a truly secure function that bypasses RLS
-- We use SECURITY DEFINER to run with the privileges of the creator (postgres)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$;

-- 2. Clean up old recursive policies on profiles
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_view_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_view_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_read_write" ON public.profiles;

-- 3. Create fresh, stable policies on profiles
-- Users can always see and update their own basic info
CREATE POLICY "profiles_self_access" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admins get full access using the secure function (breaks recursion)
CREATE POLICY "profiles_admin_manage" ON public.profiles
  FOR ALL USING (public.check_is_admin());

-- 4. Clean up users table (if it exists)
-- (Some environments use public.users, some use public.profiles)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        DROP POLICY IF EXISTS "users_admin_all" ON public.users;
        DROP POLICY IF EXISTS "users_view_own" ON public.users;
        DROP POLICY IF EXISTS "users_public_read_write" ON public.users;
        
        CREATE POLICY "users_admin_manage" ON public.users
          FOR ALL USING (public.check_is_admin());
          
        CREATE POLICY "users_self_access" ON public.users
          FOR SELECT USING (auth.uid() = id);
    END IF;
END $$;
