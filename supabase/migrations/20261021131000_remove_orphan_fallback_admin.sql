-- The admin@kotu.com profile was seeded for the removed fallback login and never had
-- a Supabase Auth user behind it, so nobody can sign in as it. Remove it only while
-- that is still true.
DELETE FROM public.profiles p
WHERE p.email = 'admin@kotu.com'
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);
