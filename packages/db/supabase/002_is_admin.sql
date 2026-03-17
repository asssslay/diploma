-- Helper function used by RLS policies to check admin role.
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion.
-- Managed outside Drizzle — apply via Supabase SQL editor or psql.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
